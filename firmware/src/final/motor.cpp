#include "motor.h"

// Meio-periodo do pulso em microssegundos. Delay maior = mais devagar.
static const unsigned US_INICIAL   = 3000;   // arranque
static const unsigned US_FINAL     = 700;    // cruzeiro
static const uint32_t PULSOS_RAMPA = 200;    // acelera nos primeiros pulsos do lote

static bool ligado = false;

static unsigned larguraPulso(uint32_t i) {
  if (i >= PULSOS_RAMPA) return US_FINAL;
  uint32_t faixa = US_INICIAL - US_FINAL;
  return US_INICIAL - (unsigned)(faixa * i / PULSOS_RAMPA);
}

void motorIniciar() {
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_DRV_WAKE, OUTPUT);

  digitalWrite(PIN_DRV_WAKE, HIGH);   // garante SLP e RST em nivel alto
  digitalWrite(PIN_STEP, LOW);
  digitalWrite(PIN_DIR, LOW);
  motorHabilitar(false);
}

void motorHabilitar(bool on) {
  // ENABLE do DRV8825 e ativo em nivel BAIXO
  digitalWrite(PIN_ENABLE, on ? LOW : HIGH);
  if (on && !ligado) delay(5);        // deixa as bobinas assentarem
  ligado = on;
}

bool motorHabilitado() { return ligado; }

void motorGirar(uint32_t pulsos, bool horario) {
  digitalWrite(PIN_DIR, horario ? LOW : HIGH);
  delayMicroseconds(50);              // setup de DIR antes do primeiro pulso

  for (uint32_t i = 0; i < pulsos; i++) {
    unsigned us = larguraPulso(i);
    digitalWrite(PIN_STEP, HIGH);
    delayMicroseconds(us);
    digitalWrite(PIN_STEP, LOW);
    delayMicroseconds(us);
    if ((i & 0x3F) == 0) yield();     // nao deixa o watchdog reclamar
  }
}
