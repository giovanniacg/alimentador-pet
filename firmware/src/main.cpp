// Alimentador Pet - FIRMWARE FINAL
//
// Junta o que cada modo de bancada provou isoladamente:
//   fase 03  balanca HX711 calibrada, fator na NVS
//   fase 04  dosagem em malha fechada (gira, pesa, repete)
//   fase 05  agenda local na NVS + DS3231, botao fisico, buzzer
//   fase 06  MQTT sobre WebSocket seguro na 443, com LWT e reconexao
//
// Principio que manda em tudo: O AGENDAMENTO E LOCAL. O broker e canal de
// comando e telemetria. Roteador desligado, internet caida, broker fora do
// ar: o bicho come na mesma hora do mesmo jeito.
//
// Gravar:   pio run -e final -t upload
// Monitor:  pio device monitor -b 115200
//
// Comandos de manutencao na serial (115200):
//   i        status completo
//   f        alimenta 30 g agora
//   t        tara a balanca (pote vazio)
//   c <g>    calibra com peso conhecido sobre o pote (ex: c 100)
//   h        ajuda

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#include "final/comum.h"
#include "final/balanca.h"
#include "final/motor.h"
#include "final/relogio.h"
#include "final/agenda.h"
#include "final/ui.h"
#include "final/dosagem.h"
#include "final/rede.h"

// ---------------------------------------------------------------- log

void logf(const char *fmt, ...) {
  char buf[220];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  Serial.printf("[%8lu] %s\n", millis(), buf);
}

// ---------------------------------------------------------------- estado

static const float GRAMAS_PADRAO = 30.0f;
static const uint32_t PERIODO_STATE_MS = 60000;

static bool     temUltimaRefeicao = false;
static String   ultimaRefeicaoTs  = "";
static float    ultimaRefeicaoG   = 0.0f;
static bool     ultimaRefeicaoOk  = false;

static uint32_t ultimoState = 0;
static uint32_t ultimaChecagemAgenda = 0;

// ---------------------------------------------------------------- publicacao

static void publicarState() {
  JsonDocument doc;
  doc["online"] = true;
  doc["rtc"]    = relogioIso();

  float peso = balancaGramas(3);
  if (isnan(peso)) doc["hopper_g"] = nullptr;
  else             doc["hopper_g"] = roundf(peso * 10.0f) / 10.0f;

  if (temUltimaRefeicao) {
    JsonObject u = doc["last_meal"].to<JsonObject>();
    u["ts"]    = ultimaRefeicaoTs;
    u["grams"] = roundf(ultimaRefeicaoG * 10.0f) / 10.0f;
    u["ok"]    = ultimaRefeicaoOk;
  } else {
    doc["last_meal"] = nullptr;
  }

  Refeicao prox;
  if (agendaProxima(prox)) {
    JsonObject p = doc["next_meal"].to<JsonObject>();
    p["h"]     = prox.hora;
    p["m"]     = prox.minuto;
    p["grams"] = prox.gramas;
  } else {
    doc["next_meal"] = nullptr;
  }

  doc["skip_next"] = agendaSkipProxima();

  String saida;
  serializeJson(doc, saida);
  redePublicar("state", saida, true);
  ultimoState = millis();
}

static void publicarSchedule() {
  redePublicar("schedule", agendaJson(), true);
}

static void publicarEvento(const String &json) {
  redePublicar("event", json, false);
}

// ---------------------------------------------------------------- acoes

static const char *motivoDe(ResultadoDose r) {
  switch (r) {
    case ResultadoDose::SEM_RACAO:    return "sem_racao";
    case ResultadoDose::TIMEOUT:      return "timeout";
    case ResultadoDose::SEM_BALANCA:  return "sem_balanca";
    default:                          return "ok";
  }
}

static void alimentar(float gramas, const char *origem) {
  logf("[refeicao] inicio | %.1f g | origem=%s", gramas, origem);
  bipInicioRefeicao();

  Dose d = dosar(gramas);

  temUltimaRefeicao = true;
  ultimaRefeicaoTs  = relogioIso();
  ultimaRefeicaoG   = d.gramasEntregues;
  ultimaRefeicaoOk  = (d.resultado == ResultadoDose::OK);

  JsonDocument ev;
  if (ultimaRefeicaoOk) {
    bipFimOk();
    ev["type"]  = "meal_done";
    ev["grams"] = roundf(d.gramasEntregues * 10.0f) / 10.0f;
  } else {
    bipFalha();
    ev["type"]   = "meal_failed";
    ev["reason"] = motivoDe(d.resultado);
    ev["grams"]  = roundf(d.gramasEntregues * 10.0f) / 10.0f;
  }
  ev["source"] = origem;
  ev["ts"]     = ultimaRefeicaoTs;

  String saida;
  serializeJson(ev, saida);
  publicarEvento(saida);
  publicarState();
}

static void tarar(const char *origem) {
  bool ok = balancaTara();
  JsonDocument ev;
  ev["type"] = "tare";
  ev["ok"]   = ok;
  ev["source"] = origem;
  String saida;
  serializeJson(ev, saida);
  publicarEvento(saida);
  publicarState();
}

static float gramasDaProxima() {
  Refeicao prox;
  if (agendaProxima(prox) && prox.gramas > 0) return (float)prox.gramas;
  return GRAMAS_PADRAO;
}

// ---------------------------------------------------------------- comandos MQTT

static void tratarSchedule(const JsonDocument &doc) {
  JsonArrayConst meals = doc["meals"].as<JsonArrayConst>();
  if (meals.isNull()) { logf("[cmd] schedule sem a lista meals"); return; }

  Refeicao lista[MAX_REFEICOES];
  uint8_t n = 0;
  for (JsonObjectConst m : meals) {
    if (n >= MAX_REFEICOES) { logf("[cmd] schedule tem mais de %d refeicoes, o resto foi ignorado", MAX_REFEICOES); break; }
    lista[n].hora   = m["h"]     | 0;
    lista[n].minuto = m["m"]     | 0;
    lista[n].gramas = m["grams"] | 0;
    n++;
  }

  if (agendaDefinir(lista, n)) {
    publicarSchedule();
    publicarState();
  }
}

static void tratarComando(const ComandoMqtt &c) {
  const char *sufixo = strrchr(c.topico, '/');
  sufixo = sufixo ? sufixo + 1 : c.topico;
  logf("[cmd] %s <- %s", sufixo, c.payload);

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, c.payload);
  if (err && strlen(c.payload) > 0) {
    logf("[cmd] JSON invalido: %s", err.c_str());
    return;
  }

  if (strcmp(sufixo, "feed") == 0) {
    float g = doc["grams"] | GRAMAS_PADRAO;
    if (g <= 0 || g > 500) { logf("[cmd] gramas fora da faixa: %.1f", g); return; }
    alimentar(g, "mqtt");

  } else if (strcmp(sufixo, "skip") == 0) {
    agendaSetSkipProxima(true);
    publicarEvento("{\"type\":\"skip_next\"}");
    publicarState();

  } else if (strcmp(sufixo, "schedule") == 0) {
    tratarSchedule(doc);

  } else if (strcmp(sufixo, "tare") == 0) {
    tarar("mqtt");

  } else {
    logf("[cmd] sufixo desconhecido: %s", sufixo);
  }
}

// ---------------------------------------------------------------- serial

static void ajuda() {
  Serial.println();
  Serial.println("=== alimentador pet | manutencao ===");
  Serial.println("  i        status completo");
  Serial.println("  f        alimenta 30 g agora");
  Serial.println("  t        tara a balanca (pote vazio)");
  Serial.println("  c <g>    calibra com peso conhecido sobre o pote (ex: c 100)");
  Serial.println("  h        esta ajuda");
  Serial.println();
}

static void status() {
  Serial.println();
  Serial.println("=== status ===");
  Serial.printf("hora ............ %s (DS3231 %s)\n", relogioIso().c_str(),
                relogioPresente() ? "ok" : "FORA");
  float t = relogioTemperatura();
  if (!isnan(t)) Serial.printf("temperatura RTC . %.1f C\n", t);

  if (balancaPresente()) {
    Serial.printf("balanca ......... %.1f g | fator %.3f contagens/g\n",
                  balancaGramas(10), balancaFator());
  } else {
    Serial.println("balanca ......... FORA (HX711 nao responde)");
  }

  Serial.printf("wifi ............ %s\n",
                redeEstado() == EstadoRede::SEM_WIFI ? "desconectado" : WiFi.localIP().toString().c_str());
  Serial.printf("broker .......... %s\n", redeOnline() ? "conectado" : "fora");
  Serial.printf("agenda .......... %u refeicoes | %s\n", agendaQuantidade(), agendaJson().c_str());

  Refeicao prox;
  if (agendaProxima(prox)) Serial.printf("proxima ......... %02u:%02u  %u g\n", prox.hora, prox.minuto, prox.gramas);
  else                     Serial.println("proxima ......... nenhuma agendada");
  Serial.printf("pular proxima ... %s\n", agendaSkipProxima() ? "sim" : "nao");

  if (temUltimaRefeicao) {
    Serial.printf("ultima refeicao . %s | %.1f g | %s\n",
                  ultimaRefeicaoTs.c_str(), ultimaRefeicaoG, ultimaRefeicaoOk ? "ok" : "FALHOU");
  } else {
    Serial.println("ultima refeicao . nenhuma desde que ligou");
  }
  Serial.printf("memoria livre ... %u bytes\n", ESP.getFreeHeap());
  Serial.println();
}

static void tratarSerial() {
  if (!Serial.available()) return;
  String linha = Serial.readStringUntil('\n');
  linha.trim();
  if (linha.length() == 0) return;

  char c = linha.charAt(0);
  switch (c) {
    case 'i': status(); break;
    case 'f': alimentar(GRAMAS_PADRAO, "serial"); break;
    case 't': tarar("serial"); break;
    case 'h': ajuda(); break;
    case 'c': {
      float peso = linha.substring(1).toFloat();
      if (peso <= 0) { Serial.println("uso: c <peso em gramas>, ex: c 100"); break; }
      Serial.printf("calibrando com %.1f g sobre o pote...\n", peso);
      if (balancaCalibrar(peso)) Serial.printf("ok. Leitura agora: %.1f g\n", balancaGramas(10));
      else                       Serial.println("falhou. Confira se a tara foi feita com o pote vazio antes.");
      break;
    }
    default: Serial.printf("comando desconhecido: %c (h = ajuda)\n", c);
  }
}

// ---------------------------------------------------------------- agenda

static void checarAgenda() {
  // De 10 em 10 segundos basta: a janela de atraso da agenda e de minutos.
  if (millis() - ultimaChecagemAgenda < 10000) return;
  ultimaChecagemAgenda = millis();

  Refeicao r;
  uint8_t indice = 0;
  if (!agendaVencida(r, indice)) return;

  if (agendaSkipProxima()) {
    logf("[agenda] refeicao %02u:%02u pulada a pedido do app", r.hora, r.minuto);
    agendaMarcarServida(indice);
    agendaSetSkipProxima(false);
    publicarEvento("{\"type\":\"meal_skipped\"}");
    publicarState();
    return;
  }

  // Marca ANTES de dosar: se faltar energia no meio da dosagem, o aparelho
  // volta sem repetir a refeicao inteira. Uma refeicao parcial e menos ruim
  // do que uma refeicao dobrada.
  agendaMarcarServida(indice);
  alimentar((float)r.gramas, "agenda");
}

// ---------------------------------------------------------------- setup / loop

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(80);   // sem isso um comando sem enter segura o loop por 1 s
  delay(400);

  Serial.println();
  Serial.println("=== alimentador pet | firmware final ===");
  Serial.printf("aparelho: feeder/%s\n", FEEDER_ID);

  uiIniciar();
  motorIniciar();
  balancaIniciar();
  relogioIniciar();
  agendaIniciar();
  redeIniciar();

  ajuda();
  status();
}

void loop() {
  redeLoop();
  uiLoop(redeEstado());
  tratarSerial();

  // WiFi acabou de subir: acerta o DS3231 pelo NTP e devolve o estado ao app.
  if (redeConsumirWifiNovo()) {
    relogioSincronizarNtp();
    publicarSchedule();
    publicarState();
  }

  ComandoMqtt c;
  if (redeProximoComando(c)) tratarComando(c);

  switch (uiBotao()) {
    case EventoBotao::FEED:
      publicarEvento("{\"type\":\"button_feed\"}");
      alimentar(gramasDaProxima(), "botao");
      break;
    case EventoBotao::TARA:
      logf("[botao] TARA");
      tarar("botao");
      break;
    default: break;
  }

  checarAgenda();

  static bool jaPublicouAoConectar = false;
  if (redeOnline() && !jaPublicouAoConectar) {
    jaPublicouAoConectar = true;
    publicarSchedule();
    publicarState();
  }
  if (!redeOnline()) jaPublicouAoConectar = false;

  if (millis() - ultimoState >= PERIODO_STATE_MS) publicarState();

  delay(5);   // cede a CPU para as tasks de WiFi e MQTT
}
