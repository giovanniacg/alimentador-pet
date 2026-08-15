#include "balanca.h"
#include <HX711.h>
#include <Preferences.h>

static HX711 hx;
static bool  ok = false;
static float fator = 1.0f;    // contagens por grama

// Espera o HX711 ficar pronto, mas nunca para sempre: o loop principal nao
// pode ficar refem de um cabo solto.
static bool esperaPronto(uint32_t limiteMs = 400) {
  uint32_t t0 = millis();
  while (!hx.is_ready()) {
    if (millis() - t0 > limiteMs) return false;
    delay(2);
  }
  return true;
}

bool balancaIniciar() {
  hx.begin(PIN_HX711_DT, PIN_HX711_SCK);

  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, true);
  fator = nvs.getFloat("fator", 420.0f);        // chute inicial de celula 5kg
  long offset = nvs.getLong("offset", 0);
  nvs.end();

  if (fator == 0.0f) fator = 420.0f;
  hx.set_scale(fator);
  hx.set_offset(offset);

  ok = esperaPronto(600);
  if (!ok) {
    logf("[balanca] HX711 nao responde (DT=%d SCK=%d)", PIN_HX711_DT, PIN_HX711_SCK);
  } else {
    logf("[balanca] ok | fator=%.3f offset=%ld", fator, offset);
  }
  return ok;
}

bool balancaPresente() { return ok; }

float balancaGramas(uint8_t amostras) {
  if (!esperaPronto()) { ok = false; return NAN; }
  ok = true;
  return (float)hx.get_units(amostras);
}

bool balancaTara() {
  if (!esperaPronto(800)) { ok = false; return false; }
  hx.tare(15);

  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, false);
  nvs.putLong("offset", hx.get_offset());
  nvs.end();

  logf("[balanca] tara feita | offset=%ld", hx.get_offset());
  return true;
}

bool balancaCalibrar(float pesoConhecidoG) {
  if (pesoConhecidoG <= 0.0f) { logf("[balanca] peso invalido"); return false; }
  if (!esperaPronto(800))     { ok = false; return false; }

  // get_value ja desconta o offset da tara. Dividido pelo peso real, da as
  // contagens por grama desta celula com este pote.
  double bruto = hx.get_value(20);
  if (fabs(bruto) < 1000.0) {
    logf("[balanca] leitura fraca demais (%.0f). O peso esta mesmo sobre o pote?", bruto);
    return false;
  }

  fator = (float)(bruto / pesoConhecidoG);
  hx.set_scale(fator);

  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, false);
  nvs.putFloat("fator", fator);
  nvs.end();

  logf("[balanca] calibrada com %.1f g | fator=%.3f contagens/g", pesoConhecidoG, fator);
  return true;
}

float balancaFator() { return fator; }
