#include "config.h"
#include "balanca.h"
#include "motor.h"
#include <Preferences.h>
#include <math.h>

// Defaults do contrato (docs/mqtt.md). A v1 sai de fabrica em TIMER de
// proposito: e o unico modo que funciona com o HX711 desconectado.
static Config cfg = {
  ModoDosagem::TIMER,
  20,      // rpm
  8,       // default_secs
  40,      // default_grams
  60,      // max_secs
  true,    // siren
  2,       // siren_secs
  5.0f     // g_per_s
};

const char *configModoNome(ModoDosagem m) {
  switch (m) {
    case ModoDosagem::SCALE_BOWL:   return "scale_bowl";
    case ModoDosagem::SCALE_HOPPER: return "scale_hopper";
    default:                        return "timer";
  }
}

static bool modoDeNome(const char *s, ModoDosagem &saida) {
  if (!s) return false;
  if (strcmp(s, "timer") == 0)        { saida = ModoDosagem::TIMER;        return true; }
  if (strcmp(s, "scale_bowl") == 0)   { saida = ModoDosagem::SCALE_BOWL;   return true; }
  if (strcmp(s, "scale_hopper") == 0) { saida = ModoDosagem::SCALE_HOPPER; return true; }
  return false;
}

static void salvar() {
  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, false);
  nvs.putUChar("cfg_modo",  (uint8_t)cfg.modo);
  nvs.putUChar("cfg_rpm",   cfg.rpm);
  nvs.putUShort("cfg_dsecs", cfg.defaultSecs);
  nvs.putUShort("cfg_dgram", cfg.defaultGrams);
  nvs.putUShort("cfg_maxs",  cfg.maxSecs);
  nvs.putBool("cfg_sir",     cfg.sirene);
  nvs.putUChar("cfg_sirs",   cfg.sireneSecs);
  nvs.putFloat("cfg_gps",    cfg.gPorS);
  nvs.end();
}

void configIniciar() {
  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, true);
  uint8_t modo      = nvs.getUChar("cfg_modo",  (uint8_t)cfg.modo);
  cfg.rpm           = nvs.getUChar("cfg_rpm",   cfg.rpm);
  cfg.defaultSecs   = nvs.getUShort("cfg_dsecs", cfg.defaultSecs);
  cfg.defaultGrams  = nvs.getUShort("cfg_dgram", cfg.defaultGrams);
  cfg.maxSecs       = nvs.getUShort("cfg_maxs",  cfg.maxSecs);
  cfg.sirene        = nvs.getBool("cfg_sir",     cfg.sirene);
  cfg.sireneSecs    = nvs.getUChar("cfg_sirs",   cfg.sireneSecs);
  cfg.gPorS         = nvs.getFloat("cfg_gps",    cfg.gPorS);
  nvs.end();

  if (modo > (uint8_t)ModoDosagem::SCALE_HOPPER) modo = (uint8_t)ModoDosagem::TIMER;
  cfg.modo = (ModoDosagem)modo;

  // Cinto de seguranca: NVS de uma versao antiga do firmware pode trazer
  // valor fora da faixa de hoje. Melhor cair no default do que girar rosca
  // com numero absurdo.
  if (cfg.rpm < CFG_RPM_MIN || cfg.rpm > CFG_RPM_MAX)       cfg.rpm = 20;
  if (cfg.maxSecs == 0 || cfg.maxSecs > CFG_MAX_SECS_TETO)  cfg.maxSecs = 60;
  if (cfg.sireneSecs > CFG_SIRENE_TETO)                     cfg.sireneSecs = 2;
  if (cfg.defaultSecs == 0 || cfg.defaultSecs > cfg.maxSecs) cfg.defaultSecs = 8;
  if (cfg.defaultGrams == 0 || cfg.defaultGrams > 500)      cfg.defaultGrams = 40;
  if (!(cfg.gPorS > 0.0f) || cfg.gPorS > 500.0f)            cfg.gPorS = 5.0f;

  motorSetRpm(cfg.rpm);
  logf("[config] modo=%s rpm=%u secs=%u grams=%u max=%u sirene=%s/%us g_por_s=%.2f",
       configModoNome(cfg.modo), cfg.rpm, cfg.defaultSecs, cfg.defaultGrams,
       cfg.maxSecs, cfg.sirene ? "sim" : "nao", cfg.sireneSecs, cfg.gPorS);
}

const Config &configAtual() { return cfg; }
ModoDosagem   configModo()  { return cfg.modo; }
bool configModoEhBalanca()  { return cfg.modo != ModoDosagem::TIMER; }

void configForcarModo(ModoDosagem m) {
  if (cfg.modo == m) return;
  cfg.modo = m;
  salvar();
  logf("[config] modo forcado para %s", configModoNome(m));
}

// ---------------------------------------------------------------- aplicar

static void rejeitar(JsonArray rejeitados, const char *campo, const char *motivo) {
  JsonObject o = rejeitados.add<JsonObject>();
  o["field"]  = campo;
  o["reason"] = motivo;
  logf("[config] campo %s rejeitado: %s", campo, motivo);
}

bool configAplicarParcial(JsonObjectConst obj, JsonArray aplicados, JsonArray rejeitados) {
  bool mudou = false;

  if (!obj["mode"].isNull()) {
    ModoDosagem m;
    if (!modoDeNome(obj["mode"].as<const char *>(), m)) {
      rejeitar(rejeitados, "mode", "valor fora de timer|scale_bowl|scale_hopper");
    } else if (m != ModoDosagem::TIMER && !balancaPresente()) {
      // Recusa explicativa: aceitar aqui deixaria o aparelho incapaz de
      // dosar, e ninguem pode ir ate la reconectar o HX711.
      rejeitar(rejeitados, "mode", "HX711 nao responde, o aparelho fica em timer");
    } else if (m != cfg.modo) {
      cfg.modo = m;
      aplicados.add("mode");
      mudou = true;
    }
  }

  if (!obj["rpm"].isNull()) {
    int v = obj["rpm"].as<int>();
    if (v < CFG_RPM_MIN || v > CFG_RPM_MAX) rejeitar(rejeitados, "rpm", "fora da faixa 5..60");
    else if (v != cfg.rpm) { cfg.rpm = (uint8_t)v; motorSetRpm(cfg.rpm); aplicados.add("rpm"); mudou = true; }
  }

  // max_secs entra ANTES de default_secs: o teto novo e quem valida a dose.
  if (!obj["max_secs"].isNull()) {
    int v = obj["max_secs"].as<int>();
    if (v < 1 || v > CFG_MAX_SECS_TETO) rejeitar(rejeitados, "max_secs", "fora da faixa 1..120");
    else if (v != cfg.maxSecs) { cfg.maxSecs = (uint16_t)v; aplicados.add("max_secs"); mudou = true; }
  }

  if (!obj["default_secs"].isNull()) {
    int v = obj["default_secs"].as<int>();
    if (v < 1 || v > (int)cfg.maxSecs) rejeitar(rejeitados, "default_secs", "fora da faixa 1..max_secs");
    else if (v != cfg.defaultSecs) { cfg.defaultSecs = (uint16_t)v; aplicados.add("default_secs"); mudou = true; }
  }

  if (!obj["default_grams"].isNull()) {
    int v = obj["default_grams"].as<int>();
    if (v < 1 || v > 500) rejeitar(rejeitados, "default_grams", "fora da faixa 1..500");
    else if (v != cfg.defaultGrams) { cfg.defaultGrams = (uint16_t)v; aplicados.add("default_grams"); mudou = true; }
  }

  if (!obj["siren"].isNull()) {
    bool v = obj["siren"].as<bool>();
    if (v != cfg.sirene) { cfg.sirene = v; aplicados.add("siren"); mudou = true; }
  }

  if (!obj["siren_secs"].isNull()) {
    int v = obj["siren_secs"].as<int>();
    if (v < 0 || v > CFG_SIRENE_TETO) rejeitar(rejeitados, "siren_secs", "fora da faixa 0..10");
    else if (v != cfg.sireneSecs) { cfg.sireneSecs = (uint8_t)v; aplicados.add("siren_secs"); mudou = true; }
  }

  if (!obj["g_per_s"].isNull()) {
    float v = obj["g_per_s"].as<float>();
    if (!(v > 0.0f) || v > 500.0f) rejeitar(rejeitados, "g_per_s", "precisa ser maior que zero e ate 500");
    else if (fabsf(v - cfg.gPorS) > 0.001f) { cfg.gPorS = v; aplicados.add("g_per_s"); mudou = true; }
  }

  if (mudou) salvar();
  return mudou;
}

String configJson() {
  JsonDocument doc;
  doc["mode"]          = configModoNome(cfg.modo);
  doc["rpm"]           = cfg.rpm;
  doc["default_secs"]  = cfg.defaultSecs;
  doc["default_grams"] = cfg.defaultGrams;
  doc["max_secs"]      = cfg.maxSecs;
  doc["siren"]         = cfg.sirene;
  doc["siren_secs"]    = cfg.sireneSecs;
  doc["g_per_s"]       = roundf(cfg.gPorS * 100.0f) / 100.0f;
  String s;
  serializeJson(doc, s);
  return s;
}

// ---------------------------------------------------------------- conversao

bool configPrecisaConverter(const Refeicao &r) {
  if (cfg.modo == ModoDosagem::TIMER) return r.segundos == 0;
  return r.gramas == 0;
}

float configSegundosDe(const Refeicao &r) {
  float s;
  if (r.segundos > 0)    s = (float)r.segundos;
  else if (r.gramas > 0) s = (float)r.gramas / cfg.gPorS;
  else                   s = (float)cfg.defaultSecs;
  if (s > (float)cfg.maxSecs) s = (float)cfg.maxSecs;   // teto de seguranca
  if (s < 0.1f) s = 0.1f;
  return s;
}

float configGramasDe(const Refeicao &r) {
  float g;
  if (r.gramas > 0)        g = (float)r.gramas;
  else if (r.segundos > 0) g = (float)r.segundos * cfg.gPorS;
  else                     g = (float)cfg.defaultGrams;
  if (g < 1.0f)   g = 1.0f;
  if (g > 500.0f) g = 500.0f;
  return g;
}
