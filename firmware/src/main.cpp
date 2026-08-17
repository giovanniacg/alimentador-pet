// Alimentador Pet - FIRMWARE FINAL
//
// Junta o que cada modo de bancada provou isoladamente:
//   fase 03  balanca HX711 calibrada, fator na NVS (OPCIONAL na v1)
//   fase 04  dosagem: por TEMPO na v1, em malha fechada quando houver celula
//   fase 05  agenda local na NVS + DS3231, botao fisico, sirene
//   fase 06  MQTT sobre WebSocket seguro na 443, com LWT e reconexao
//
// Principio que manda em tudo: O AGENDAMENTO E LOCAL. O broker e canal de
// comando e telemetria. Roteador desligado, internet caida, broker fora do
// ar: o bicho come na mesma hora do mesmo jeito.
//
// Segundo principio, que nasceu da realidade: o aparelho opera a 1000 km de
// quem o programou, na casa dos pais, com publico nao tecnico. Entao TUDO que
// muda comportamento (modo de dosagem, rpm, tamanho da dose, teto de
// seguranca, sirene) e configuravel por MQTT, sem regravar firmware. Ver
// docs/mqtt.md, que e o contrato.
//
// Gravar:   pio run -e final -t upload
// Monitor:  pio device monitor -b 115200
//
// Comandos de manutencao na serial (115200):
//   i        status completo
//   g        mostra a config vigente
//   f        alimenta a dose padrao agora
//   t        tara a balanca (so modos scale)
//   c <g>    calibra com peso conhecido sobre a celula (ex: c 100)
//   h        ajuda

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <math.h>

#include "final/comum.h"
#include "final/config.h"
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

static const uint32_t PERIODO_STATE_MS = 60000;

static bool     temUltimaRefeicao = false;
static String   ultimaRefeicaoTs  = "";
static Dose     ultimaDose        = {};

static uint32_t ultimoState = 0;
static uint32_t ultimaChecagemAgenda = 0;

// ---------------------------------------------------------------- helpers

static float arred1(float v) { return roundf(v * 10.0f) / 10.0f; }

// Preenche o par secs/grams de um objeto (last_meal, next_meal) conforme o
// modo vigente: o app le o campo que faz sentido para o modo em que o
// aparelho esta, e nao um numero que nao significa nada.
static void escreverDose(JsonObject o, float segundos, float gramas) {
  if (configModo() == ModoDosagem::TIMER) {
    o["secs"] = arred1(segundos);
  } else {
    o["grams"] = arred1(gramas);
  }
}

// ---------------------------------------------------------------- publicacao

static void publicarState() {
  JsonDocument doc;
  doc["online"] = true;
  doc["fw"]     = FW_CONTRATO;
  doc["rtc"]    = relogioIso();
  doc["mode"]   = configModoNome(configModo());

  // scale_g so existe nos modos scale. No modo timer nao ha o que medir, e um
  // numero inventado ali viraria decisao errada do outro lado.
  if (configModoEhBalanca() && balancaPresente()) {
    float peso = balancaGramas(3);
    if (isnan(peso)) doc["scale_g"] = nullptr;
    else             doc["scale_g"] = arred1(peso);
  } else {
    doc["scale_g"] = nullptr;
  }

  if (temUltimaRefeicao) {
    JsonObject u = doc["last_meal"].to<JsonObject>();
    u["ts"] = ultimaRefeicaoTs;
    escreverDose(u, ultimaDose.segundosGirados, ultimaDose.gramasEntregues);
    u["ok"] = (ultimaDose.resultado == ResultadoDose::OK);
  } else {
    doc["last_meal"] = nullptr;
  }

  Refeicao prox;
  if (agendaProxima(prox)) {
    JsonObject p = doc["next_meal"].to<JsonObject>();
    p["h"] = prox.hora;
    p["m"] = prox.minuto;
    escreverDose(p, configSegundosDe(prox), configGramasDe(prox));
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

static void publicarConfig() {
  redePublicar("config", configJson(), true);
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

static void alimentar(const Refeicao &pedido, const char *origem) {
  const Config &cfg = configAtual();

  // Sirene ANTES de girar a rosca: o cachorro tem que chegar no prato junto
  // com a comida, nao depois. Bloqueia por siren_secs, e isso e de proposito.
  if (cfg.sirene) sirene(cfg.sireneSecs);
  bipInicioRefeicao();

  Dose d = dosar(pedido);

  temUltimaRefeicao = true;
  ultimaRefeicaoTs  = relogioIso();
  ultimaDose        = d;

  JsonDocument ev;
  bool ok = (d.resultado == ResultadoDose::OK);
  if (ok) {
    bipFimOk();
    ev["type"] = "meal_done";
  } else {
    bipFalha();
    ev["type"]   = "meal_failed";
    ev["reason"] = motivoDe(d.resultado);
  }
  ev["mode"] = configModoNome(d.modo);
  if (d.modo == ModoDosagem::TIMER) {
    ev["secs"] = arred1(d.segundosGirados);
  } else {
    ev["grams"] = arred1(d.gramasEntregues);
    ev["secs"]  = arred1(d.segundosGirados);
  }
  // Marca quando o alvo veio no campo errado para o modo e foi convertido
  // pelo g_per_s: e estimativa, e o app precisa saber disso.
  if (d.convertido) ev["converted"] = true;
  ev["source"] = origem;
  ev["ts"]     = ultimaRefeicaoTs;

  String saida;
  serializeJson(ev, saida);
  publicarEvento(saida);
  publicarState();
}

// Dose "padrao": a do botao fisico e a do feed sem payload. Refeicao zerada
// significa "usa o default do modo vigente" (default_secs ou default_grams).
static void alimentarPadrao(const char *origem) {
  Refeicao r = {};   // sem secs nem grams: a config resolve pelo default do modo
  alimentar(r, origem);
}

static void tarar(const char *origem) {
  bool ok = balancaTara();
  JsonDocument ev;
  ev["type"]   = "tare";
  ev["ok"]     = ok;
  ev["source"] = origem;
  String saida;
  serializeJson(ev, saida);
  publicarEvento(saida);
  publicarState();
}

// ---------------------------------------------------------------- comandos MQTT

static void tratarSchedule(const JsonDocument &doc) {
  JsonArrayConst meals = doc["meals"].as<JsonArrayConst>();
  if (meals.isNull()) { logf("[cmd] schedule sem a lista meals"); return; }

  Refeicao lista[MAX_REFEICOES] = {};
  uint8_t n = 0;
  for (JsonObjectConst m : meals) {
    if (n >= MAX_REFEICOES) { logf("[cmd] schedule tem mais de %d refeicoes, o resto foi ignorado", MAX_REFEICOES); break; }
    lista[n].hora     = m["h"]     | 0;
    lista[n].minuto   = m["m"]     | 0;
    lista[n].gramas   = m["grams"] | 0;
    lista[n].segundos = m["secs"]  | 0;
    n++;
  }

  if (agendaDefinir(lista, n)) {
    publicarSchedule();
    publicarState();
  }
}

static void tratarConfig(const JsonDocument &doc) {
  JsonObjectConst obj = doc.as<JsonObjectConst>();
  if (obj.isNull()) { logf("[cmd] config sem objeto"); return; }

  JsonDocument ev;
  ev["type"] = "config_changed";
  JsonArray aplicados  = ev["applied"].to<JsonArray>();
  JsonArray rejeitados = ev["rejected"].to<JsonArray>();

  bool mudou = configAplicarParcial(obj, aplicados, rejeitados);
  ev["changed"] = mudou;

  String saida;
  serializeJson(ev, saida);
  publicarEvento(saida);

  // Republica o espelho mesmo sem mudanca: se algo foi rejeitado, o app
  // precisa ver de volta o valor que de fato vale.
  publicarConfig();
  publicarState();
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
    Refeicao r = {};
    r.segundos = doc["secs"]  | 0;
    r.gramas   = doc["grams"] | 0;
    if (r.gramas > 500) { logf("[cmd] grams fora da faixa: %u", r.gramas); return; }
    if (r.segundos > configAtual().maxSecs) {
      logf("[cmd] secs acima do teto de %u s: %u", configAtual().maxSecs, r.segundos);
      return;
    }
    alimentar(r, "mqtt");

  } else if (strcmp(sufixo, "skip") == 0) {
    agendaSetSkipProxima(true);
    publicarEvento("{\"type\":\"skip_next\"}");
    publicarState();

  } else if (strcmp(sufixo, "schedule") == 0) {
    tratarSchedule(doc);

  } else if (strcmp(sufixo, "config") == 0) {
    tratarConfig(doc);

  } else if (strcmp(sufixo, "siren") == 0) {
    // Sirene sozinha, sem dosar: serve para chamar o cachorro, testar a peca
    // de longe e conferir que o aparelho esta vivo sem gastar racao.
    // Roda aqui, no loop principal, porque bloqueia por segundos - dentro do
    // handler do esp-mqtt isso derrubaria a conexao.
    int secs = doc["secs"] | (int)configAtual().sireneSecs;
    if (secs < 1) secs = 1;
    if (secs > CFG_SIRENE_TETO) secs = CFG_SIRENE_TETO;   // clamp, nao recusa
    sirene((uint8_t)secs);
    JsonDocument ev;
    ev["type"] = "siren";
    ev["secs"] = secs;
    String saida;
    serializeJson(ev, saida);
    publicarEvento(saida);
    publicarState();

  } else if (strcmp(sufixo, "tare") == 0) {
    tarar("mqtt");

  } else if (strcmp(sufixo, "calibrate") == 0) {
    float g = doc["known_g"] | 0.0f;
    bool ok = (g > 0.0f) && balancaCalibrar(g);
    JsonDocument ev;
    ev["type"]   = "calibrate";
    ev["ok"]     = ok;
    ev["factor"] = balancaFator();
    String saida;
    serializeJson(ev, saida);
    publicarEvento(saida);
    publicarState();

  } else {
    logf("[cmd] sufixo desconhecido: %s", sufixo);
  }
}

// ---------------------------------------------------------------- serial

static void ajuda() {
  Serial.println();
  Serial.println("=== alimentador pet | manutencao ===");
  Serial.println("  i        status completo");
  Serial.println("  g        config vigente (modo, rpm, dose, sirene)");
  Serial.println("  f        alimenta a dose padrao agora");
  Serial.println("  t        tara a balanca (so modos scale)");
  Serial.println("  c <g>    calibra com peso conhecido sobre a celula (ex: c 100)");
  Serial.println("  h        esta ajuda");
  Serial.println();
}

static void mostrarConfig() {
  const Config &cfg = configAtual();
  Serial.println();
  Serial.println("=== config vigente ===");
  Serial.printf("modo ............ %s\n", configModoNome(cfg.modo));
  Serial.printf("rpm ............. %u\n", cfg.rpm);
  Serial.printf("dose padrao ..... %u s | %u g\n", cfg.defaultSecs, cfg.defaultGrams);
  Serial.printf("teto por dose ... %u s\n", cfg.maxSecs);
  Serial.printf("sirene .......... %s | %u s\n", cfg.sirene ? "ligada" : "desligada", cfg.sireneSecs);
  Serial.printf("g por segundo ... %.2f (estimativa de conversao)\n", cfg.gPorS);
  Serial.printf("balanca ......... %s\n", balancaPresente() ? "presente" : "AUSENTE (so modo timer)");
  Serial.printf("json ............ %s\n", configJson().c_str());
  Serial.println();
}

static void status() {
  Serial.println();
  Serial.println("=== status ===");
  Serial.printf("hora ............ %s (DS3231 %s)\n", relogioIso().c_str(),
                relogioPresente() ? "ok" : "FORA");
  float t = relogioTemperatura();
  if (!isnan(t)) Serial.printf("temperatura RTC . %.1f C\n", t);

  Serial.printf("modo ............ %s\n", configModoNome(configModo()));
  if (balancaPresente()) {
    Serial.printf("balanca ......... %.1f g | fator %.3f contagens/g\n",
                  balancaGramas(10), balancaFator());
  } else {
    Serial.println("balanca ......... FORA (HX711 nao responde) - dosagem por tempo");
  }

  Serial.printf("wifi ............ %s\n",
                redeEstado() == EstadoRede::SEM_WIFI ? "desconectado" : WiFi.localIP().toString().c_str());
  Serial.printf("broker .......... %s\n", redeOnline() ? "conectado" : "fora");
  Serial.printf("agenda .......... %u refeicoes | %s\n", agendaQuantidade(), agendaJson().c_str());

  Refeicao prox;
  if (agendaProxima(prox)) {
    Serial.printf("proxima ......... %02u:%02u  %.1f s / %.1f g\n",
                  prox.hora, prox.minuto, configSegundosDe(prox), configGramasDe(prox));
  } else {
    Serial.println("proxima ......... nenhuma agendada");
  }
  Serial.printf("pular proxima ... %s\n", agendaSkipProxima() ? "sim" : "nao");

  if (temUltimaRefeicao) {
    if (ultimaDose.modo == ModoDosagem::TIMER) {
      Serial.printf("ultima refeicao . %s | %.1f s | %s\n", ultimaRefeicaoTs.c_str(),
                    ultimaDose.segundosGirados,
                    ultimaDose.resultado == ResultadoDose::OK ? "ok" : "FALHOU");
    } else {
      Serial.printf("ultima refeicao . %s | %.1f g | %s\n", ultimaRefeicaoTs.c_str(),
                    ultimaDose.gramasEntregues,
                    ultimaDose.resultado == ResultadoDose::OK ? "ok" : "FALHOU");
    }
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
    case 'g': mostrarConfig(); break;
    case 'f': alimentarPadrao("serial"); break;
    case 't': tarar("serial"); break;
    case 'h': ajuda(); break;
    case 'c': {
      float peso = linha.substring(1).toFloat();
      if (peso <= 0) { Serial.println("uso: c <peso em gramas>, ex: c 100"); break; }
      Serial.printf("calibrando com %.1f g sobre a celula...\n", peso);
      if (balancaCalibrar(peso)) Serial.printf("ok. Leitura agora: %.1f g\n", balancaGramas(10));
      else                       Serial.println("falhou. Confira se a tara foi feita com o prato vazio antes.");
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
  alimentar(r, "agenda");
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

  // A balanca vem ANTES da config de proposito: a config precisa saber se o
  // HX711 respondeu para decidir se pode ficar num modo scale.
  balancaIniciar();
  configIniciar();

  // Sem HX711 nenhum modo scale funciona, e nao ha ninguem la para reconectar
  // o modulo. Cair para timer e a unica saida que mantem o bicho comendo.
  if (configModoEhBalanca() && !balancaPresente()) {
    logf("[boot] config pede %s mas o HX711 nao responde: caindo para timer",
         configModoNome(configModo()));
    configForcarModo(ModoDosagem::TIMER);
  }

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
    publicarConfig();
    publicarSchedule();
    publicarState();
  }

  ComandoMqtt c;
  if (redeProximoComando(c)) tratarComando(c);

  switch (uiBotao()) {
    case EventoBotao::FEED:
      publicarEvento("{\"type\":\"button_feed\"}");
      alimentarPadrao("botao");
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
    publicarConfig();
    publicarSchedule();
    publicarState();
  }
  if (!redeOnline()) jaPublicouAoConectar = false;

  if (millis() - ultimoState >= PERIODO_STATE_MS) publicarState();

  delay(5);   // cede a CPU para as tasks de WiFi e MQTT
}
