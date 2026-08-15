// Alimentador Pet - modo CRU (codigo canonico de tutorial, sem nada meu)
//
// Replica exata do padrao usado nos tutoriais de ESP32 + DRV8825 (Crescer
// Engenharia, lastminuteengineers): full step, pulso simetrico de 2000 us,
// 200 passos para um lado, pausa, 200 para o outro. Nenhuma rampa, nenhuma
// biblioteca, nenhuma variacao.
//
// Jumpers esperados: M0, M1 e M2 todos SOLTOS (full step, 200 passos/volta).
//
// Leitura do resultado:
//   - da 1 volta pra cada lado ........ tudo certo, o problema era firmware
//   - vibra forte e nao gira .......... com ESTE codigo, o problema NAO e
//     firmware: e eletrico. Em full step lento, "vibra e nao gira" e a
//     assinatura classica de UMA BOBINA ABERTA (fio partido / mau contato no
//     cabo do motor) ou de par de bobina trocado no driver (um fio de cada
//     bobina invertido entre 1A/1B/2A/2B).

#include <Arduino.h>
#include "pinout.h"

static const unsigned MEIO_PERIODO_US = 2000;  // igual aos tutoriais
static const int PASSOS = 200;                 // 1 volta em full step

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_DRV_WAKE, OUTPUT);

  digitalWrite(PIN_DRV_WAKE, HIGH);  // SLP e RST em nivel alto
  digitalWrite(PIN_ENABLE, LOW);     // habilita o driver
  digitalWrite(PIN_STEP, LOW);

  Serial.println();
  Serial.println("=== modo cru: codigo de tutorial, full step ===");
  Serial.println("M0/M1/M2 soltos. 200 passos (1 volta) pra cada lado, pulso 2000 us.");
  Serial.println();
}

void loop() {
  Serial.println("horario: 200 passos...");
  digitalWrite(PIN_LED, HIGH);
  digitalWrite(PIN_DIR, HIGH);
  delay(10);
  for (int i = 0; i < PASSOS; i++) {
    digitalWrite(PIN_STEP, HIGH);
    delayMicroseconds(MEIO_PERIODO_US);
    digitalWrite(PIN_STEP, LOW);
    delayMicroseconds(MEIO_PERIODO_US);
  }
  delay(1000);

  Serial.println("anti-horario: 200 passos...");
  digitalWrite(PIN_LED, LOW);
  digitalWrite(PIN_DIR, LOW);
  delay(10);
  for (int i = 0; i < PASSOS; i++) {
    digitalWrite(PIN_STEP, HIGH);
    delayMicroseconds(MEIO_PERIODO_US);
    digitalWrite(PIN_STEP, LOW);
    delayMicroseconds(MEIO_PERIODO_US);
  }
  delay(1000);
}
