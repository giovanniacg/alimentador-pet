// Alimentador Pet - modo SINAL DE VIDA
//
// Gira o motor em um sentido so, continuamente, e usa o LED da placa como
// prova de que os pulsos estao saindo de verdade.
//
// O LED NAO pisca por um timer paralelo: ele inverte a cada 100 passos, dentro
// do mesmo laco que gera os pulsos. Entao o pisca-pisca e consequencia direta
// do STEP sendo pulsado. Isso torna o diagnostico binario:
//
//   LED piscando + motor parado .... os pulsos saem da ESP32. O problema esta
//                                    depois dela: driver dormindo (SLP/RST sem
//                                    3V3), sem 12V no UMOT, ou fiacao
//   LED apagado ou fixo ............ o firmware nao esta rodando
//
// Pulso largo (1000 us), sentido unico, sem biblioteca. O mais simples possivel.

#include <Arduino.h>
#include "pinout.h"

static const unsigned LARGURA_US   = 1000;  // metade do periodo
static const int      PASSOS_LED   = 100;   // inverte o LED a cada 100 passos

unsigned long passos = 0;
unsigned long ultimoLog = 0;

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  // GPIO 14 vira uma fonte de nivel alto permanente para SLP e RST do driver.
  // Assim eles nao dependem do fio que vem do pino 3V3 - que e justamente o
  // suspeito de ter saido junto com os jumpers de M0/M1. SLP e RST sao entradas
  // de alta impedancia e consomem microamperes, entao um GPIO da conta.
  pinMode(PIN_DRV_WAKE, OUTPUT);
  digitalWrite(PIN_DRV_WAKE, HIGH);

  digitalWrite(PIN_ENABLE, LOW);   // habilita o driver
  digitalWrite(PIN_DIR, LOW);      // sentido fixo
  digitalWrite(PIN_STEP, LOW);

  Serial.println();
  Serial.println("=== sinal de vida ===");
  Serial.println("GPIO 14 esta em nivel ALTO: ligue SLP e RST nele.");
  Serial.println("LED inverte a cada 100 passos - o pisca prova que o STEP pulsa.");
  Serial.println();
  Serial.println("LED piscando e motor parado = pulsos saem, problema e depois da ESP32:");
  Serial.println("  SLP e RST sem 3V3 (driver dormindo) | sem 12V no UMOT | fiacao");
  Serial.println();

  // tres piscadas rapidas no boot: marca que o firmware subiu agora
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED, HIGH); delay(120);
    digitalWrite(PIN_LED, LOW);  delay(120);
  }
}

void loop() {
  digitalWrite(PIN_STEP, HIGH);
  delayMicroseconds(LARGURA_US);
  digitalWrite(PIN_STEP, LOW);
  delayMicroseconds(LARGURA_US);

  passos++;

  if (passos % PASSOS_LED == 0) {
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
  }

  if (millis() - ultimoLog >= 2000) {
    ultimoLog = millis();
    // em full step (M0/M1/M2 soltos) sao 200 passos por volta
    Serial.printf("vivo | %lu passos | ~%.1f voltas em full step\n",
                  passos, passos / 200.0);
  }
}
