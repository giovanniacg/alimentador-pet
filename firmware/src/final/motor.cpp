#include "motor.h"

// Meio-periodo do pulso em microssegundos. Delay maior = mais devagar.
// O arranque de 3000 us e o validado na bancada (modo_rampa / modo_teste) e
// nao muda com a config: motor de passo nao parte direto na velocidade final.
static const unsigned US_ARRANQUE  = 3000;
static const uint32_t PULSOS_RAMPA = 200;    // acelera nos primeiros pulsos do lote
static const unsigned US_PISO      = 250;    // limite fisico do driver

static unsigned usCruzeiro = 937;   // ~20 RPM, o default do contrato
static unsigned usInicial  = US_ARRANQUE;
static uint8_t  rpmAtual   = 20;

static bool ligado = false;

// Meio-periodo que entrega o RPM pedido:
//   um pulso = dois meio-periodos; uma volta = PULSOS_POR_VOLTA pulsos.
//   us = 60e6 / (rpm * PULSOS_POR_VOLTA * 2)
void motorSetRpm(uint8_t rpm) {
  if (rpm < CFG_RPM_MIN) rpm = CFG_RPM_MIN;
  if (rpm > CFG_RPM_MAX) rpm = CFG_RPM_MAX;
  rpmAtual = rpm;

  unsigned long us = 60000000UL / ((unsigned long)rpm * PULSOS_POR_VOLTA * 2UL);
  if (us < US_PISO) us = US_PISO;
  usCruzeiro = (unsigned)us;

  // Em RPM baixo o cruzeiro fica mais lento que o arranque; ai nao ha rampa
  // nenhuma para fazer, so gira devagar do comeco.
  usInicial = usCruzeiro > US_ARRANQUE ? usCruzeiro : US_ARRANQUE;

  logf("[motor] rpm=%u | meio-periodo de cruzeiro=%u us", rpmAtual, usCruzeiro);
}

uint8_t motorRpm() { return rpmAtual; }

static unsigned larguraPulso(uint32_t i) {
  if (i >= PULSOS_RAMPA || usInicial == usCruzeiro) return usCruzeiro;
  unsigned faixa = usInicial - usCruzeiro;
  return usInicial - (unsigned)((unsigned long)faixa * i / PULSOS_RAMPA);
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

float motorGirarPorTempo(float segundos, bool horario) {
  if (!(segundos > 0.0f)) return 0.0f;

  digitalWrite(PIN_DIR, horario ? LOW : HIGH);
  delayMicroseconds(50);

  uint32_t limiteMs = (uint32_t)(segundos * 1000.0f);
  uint32_t t0 = millis();
  uint32_t i  = 0;

  while (millis() - t0 < limiteMs) {
    unsigned us = larguraPulso(i);
    digitalWrite(PIN_STEP, HIGH);
    delayMicroseconds(us);
    digitalWrite(PIN_STEP, LOW);
    delayMicroseconds(us);
    i++;
    if ((i & 0x3F) == 0) yield();
  }
  return (millis() - t0) / 1000.0f;
}
