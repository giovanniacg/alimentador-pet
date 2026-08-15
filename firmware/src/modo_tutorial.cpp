// Alimentador Pet - modo TUTORIAL (bit-bang no padrao dos tutoriais)
//
// Por que este modo existe: o firmware anterior usava pulso de STEP de 5 us,
// que respeita o minimo de 1,9 us do datasheet mas e 400x mais estreito do que
// os exemplos canonicos usam na pratica. Em protoboard, com fio comprido, um
// pulso tao curto pode chegar deformado ao driver.
//
// Aqui o pulso e simetrico e largo, igual ao exemplo do lastminuteengineers:
//     digitalWrite(step, HIGH); delayMicroseconds(2000);
//     digitalWrite(step, LOW);  delayMicroseconds(2000);
//
// O firmware varre quatro velocidades e testa os DOIS pinos candidatos a STEP,
// entao cobre de uma vez a duvida de largura de pulso e a de fiacao trocada.
//
// RECOMENDADO antes de rodar: tire os jumpers de M0 e M1 do 3V3, deixando M0,
// M1 e M2 todos soltos. Isso poe o driver em FULL STEP, que entrega bem mais
// torque por pulso do que 1/8 de micropasso - e torque e justamente o que
// parece estar faltando.

#include <Arduino.h>
#include "pinout.h"

// larguras de pulso a testar, em microssegundos (metade do periodo)
const unsigned LARGURAS[] = {2000, 1000, 500, 200};
const int N_LARGURAS = 4;
const int PASSOS_POR_TRECHO = 100;   // 100 passos: meia volta em full step

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  digitalWrite(PIN_ENABLE, LOW);     // habilita o driver
  digitalWrite(PIN_STEP, LOW);
  digitalWrite(PIN_DIR, LOW);

  Serial.println();
  Serial.println("=== modo tutorial: pulso largo e simetrico ===");
  Serial.println("Testa 4 larguras de pulso em cada um dos 2 pinos candidatos.");
  Serial.println("Anote em qual combinacao o eixo se mexe.");
  Serial.println();
  Serial.println("Se voce tirou os jumpers de M0/M1: full step, 200 passos/volta.");
  Serial.println("Se deixou no 3V3: 1/8 de micropasso, gira 8x mais devagar.");
  Serial.println();
}

// Pulsa 'passos' vezes no pino indicado, com largura simetrica.
void pulsa(int pinoStep, int pinoDir, unsigned largura, int passos, bool sentido) {
  digitalWrite(pinoDir, sentido ? HIGH : LOW);
  delayMicroseconds(50);                     // DIR precisa estabilizar antes do STEP
  for (int i = 0; i < passos; i++) {
    digitalWrite(pinoStep, HIGH);
    delayMicroseconds(largura);
    digitalWrite(pinoStep, LOW);
    delayMicroseconds(largura);
  }
}

void trecho(int pinoStep, int pinoDir, const char* nomeStep) {
  for (int k = 0; k < N_LARGURAS; k++) {
    unsigned L = LARGURAS[k];
    Serial.printf("STEP=%s | pulso %u us | ida...\n", nomeStep, L);
    digitalWrite(PIN_LED, HIGH);
    pulsa(pinoStep, pinoDir, L, PASSOS_POR_TRECHO, false);
    delay(700);

    Serial.printf("STEP=%s | pulso %u us | volta...\n", nomeStep, L);
    digitalWrite(PIN_LED, LOW);
    pulsa(pinoStep, pinoDir, L, PASSOS_POR_TRECHO, true);
    delay(1200);
  }
}

void loop() {
  Serial.println("========== testando GPIO 26 como STEP ==========");
  trecho(PIN_STEP, PIN_DIR, "GPIO26");

  Serial.println("========== testando GPIO 27 como STEP ==========");
  trecho(PIN_DIR, PIN_STEP, "GPIO27");

  Serial.println("--- ciclo completo, recomecando ---\n");
}
