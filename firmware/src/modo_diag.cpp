// Alimentador Pet - DIAGNOSTICO de STEP/DIR
//
// Sintoma que este modo investiga: o motor fica DURO (energizado, segurando a
// posicao com forca) mas nao avanca.
//
// Motor duro ja prova que estao certos: alimentacao 12V, driver acordado,
// VREF entregando corrente, bobinas pareadas e contatos firmes. O que falta e
// o pulso de STEP chegar ao driver.
//
// A causa mais comum e STP e DIR invertidos no chicote. Este firmware descobre
// isso sozinho: pulsa alternadamente o GPIO 26 e o GPIO 27, 10 s cada, e
// anuncia qual esta ativo. O trecho em que o eixo se mover revela onde o STP
// esta de verdade ligado.
//
// Roda bem devagar (2 RPM) para dar torque maximo e ser facil de ver a olho.

#include <Arduino.h>
#include "pinout.h"

static const int  PINO_A     = PIN_STEP;   // GPIO 26, o que deveria ser o STP
static const int  PINO_B     = PIN_DIR;    // GPIO 27, o que deveria ser o DIR
static const float RPM       = 2.0;        // bem lento: torque maximo
static const unsigned TRECHO = 10000;      // 10 s em cada pino

unsigned long periodoUs() { return (unsigned long)(60.0 * 1000000.0 / (RPM * PULSOS_POR_VOLTA)); }

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PINO_A, OUTPUT);
  pinMode(PINO_B, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_ENABLE, LOW);   // habilita o driver

  Serial.println();
  Serial.println("=== diagnostico STEP/DIR ===");
  Serial.println("Pulsa GPIO 26 por 10s, depois GPIO 27 por 10s, alternando.");
  Serial.println("Olhe o eixo: o trecho em que ele SE MOVER diz onde o STP esta.");
  Serial.println();
  Serial.println("  moveu no GPIO 26 .... fiacao certa, o problema era outro");
  Serial.println("  moveu no GPIO 27 .... STP e DIR estao invertidos");
  Serial.println("  nao moveu em nenhum . o STP nao esta conectado a lugar nenhum");
  Serial.println();
}

void pulsaPor(int pino, int outro, unsigned ms, const char* nome) {
  Serial.printf("--> pulsando %s por %u s ...\n", nome, ms / 1000);
  digitalWrite(outro, LOW);                 // o outro fica quieto
  unsigned long fim = millis() + ms;
  unsigned long meio = periodoUs() / 2;
  while (millis() < fim) {
    digitalWrite(pino, HIGH);
    delayMicroseconds(5);                   // DRV8825 exige pulso > 1,9 us
    digitalWrite(pino, LOW);
    delayMicroseconds(meio > 5 ? meio - 5 : 1);
    digitalWrite(PIN_LED, (millis() / 250) % 2);
  }
}

void loop() {
  pulsaPor(PINO_A, PINO_B, TRECHO, "GPIO 26 (deveria ser STP)");
  pulsaPor(PINO_B, PINO_A, TRECHO, "GPIO 27 (deveria ser DIR)");
}
