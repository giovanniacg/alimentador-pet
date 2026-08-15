// Alimentador Pet - modo RAMPA (calibrado para half step)
//
// Observacao de bancada (15/08): em 1/8 de micropasso o motor so vibra parado;
// em half/full step ele se move, ainda que travando. Isso e assinatura de
// CORRENTE INSUFICIENTE - em micropasso o empurrao por pulso e menor, entao
// falta de torque aparece primeiro ali. O ajuste do VREF e o proximo passo.
//
// Corrige dois erros dos firmwares anteriores:
//
// 1. SEM RAMPA DE ACELERACAO. Motor de passo nao parte direto em velocidade
//    final: o rotor nao acompanha o campo girante, perde sincronismo e fica
//    vibrando parado. O firmware anterior mandava 500 passos/s desde o
//    primeiro pulso - em full step isso e arrancar direto a 150 RPM, o que
//    nenhum motor de passo faz.
//
// 2. FULL STEP TEM RESSONANCIA. Existe uma faixa de velocidade em que o motor
//    em passo inteiro entra em ressonancia mecanica e trava vibrando. E por
//    isso que micropasso existe. Este modo assume 1/8 (M0 e M1 no 3V3, M2
//    solto), que e bem mais suave.
//
// A rampa vai de ~7 RPM ate ~30 RPM ao longo de 600 pulsos e depois se mantem.
// Comeca devagar de proposito: e no arranque que o motor perde o passo.

#include <Arduino.h>
#include "pinout.h"

// MODO DE MICROPASSO EM USO. Trocar aqui quando trocar os jumpers:
//   200  = full step   (M0, M1, M2 todos soltos)
//   400  = half step   (M0 no 3V3; M1 e M2 soltos)     <- em uso
//   1600 = 1/8         (M0 e M1 no 3V3; M2 solto)
// Isto muda a velocidade real: com o mesmo delay, menos micropasso = mais RPM.
static const int PULSOS_VOLTA = 400;

// Meio-periodo do pulso, em microssegundos. Delay MAIOR = mais devagar.
// Calibrado para half step: arranque ~7 RPM, cruzeiro ~20 RPM.
static const unsigned US_INICIAL = 10000;  // arranque bem lento
static const unsigned US_FINAL   = 3750;   // cruzeiro
static const unsigned PASSOS_RAMPA = 300;  // quantos pulsos para acelerar

unsigned long passos = 0;
unsigned long ultimoLog = 0;

unsigned larguraAtual() {
  if (passos >= PASSOS_RAMPA) return US_FINAL;
  // interpolacao linear do delay ao longo da rampa
  unsigned long faixa = US_INICIAL - US_FINAL;
  return US_INICIAL - (unsigned)(faixa * passos / PASSOS_RAMPA);
}

float rpmAtual(unsigned us) {
  float pps = 1000000.0 / (2.0 * us);
  return pps * 60.0 / PULSOS_VOLTA;
}

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_DRV_WAKE, OUTPUT);

  digitalWrite(PIN_DRV_WAKE, HIGH);   // acorda SLP e RST
  digitalWrite(PIN_ENABLE, LOW);      // habilita
  digitalWrite(PIN_DIR, LOW);         // sentido fixo
  digitalWrite(PIN_STEP, LOW);

  Serial.println();
  Serial.println("=== modo rampa ===");
  Serial.printf("Assumindo %d pulsos por volta (half step: M0 no 3V3, M1 e M2 soltos).\n", PULSOS_VOLTA);
  Serial.printf("Acelera de %.1f RPM ate %.1f RPM em %u pulsos.\n",
                rpmAtual(US_INICIAL), rpmAtual(US_FINAL), PASSOS_RAMPA);
  Serial.println("GPIO 14 em nivel alto para SLP e RST.");
  Serial.println();

  delay(500);   // deixa as bobinas assentarem antes do primeiro pulso
}

void loop() {
  unsigned us = larguraAtual();

  digitalWrite(PIN_STEP, HIGH);
  delayMicroseconds(us);
  digitalWrite(PIN_STEP, LOW);
  delayMicroseconds(us);

  passos++;
  if (passos % 100 == 0) digitalWrite(PIN_LED, !digitalRead(PIN_LED));

  if (millis() - ultimoLog >= 2000) {
    ultimoLog = millis();
    Serial.printf("%lu pulsos | %.1f RPM | %.2f voltas | %s\n",
                  passos, rpmAtual(us), passos / (float)PULSOS_VOLTA,
                  passos < PASSOS_RAMPA ? "acelerando" : "cruzeiro");
  }
}
