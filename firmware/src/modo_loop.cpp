// Alimentador Pet - modo LOOP AUTONOMO (bancada de campo)
//
// Liga na tomada e comeca a girar sozinho: 10 s para um lado, 10 s para o
// outro, indefinidamente. Nao depende de USB, de WiFi nem de comando nenhum.
//
// Serve para levar o conjunto ate onde o projeto vai ser montado e observar o
// comportamento mecanico: se a rosca puxa racao, se trava, se aquece, se faz
// barulho demais. E o teste de resistencia da fase 02.
//
// ALIMENTACAO SEM USB - os tres precisam estar ligados:
//   12 V da fonte  -> UMOT do driver
//   5 V do LM2596  -> VIN do ESP32          <- sem isto nada acontece
//   GND comum      -> fonte, driver e ESP32
// O 3V3 que segura SLP, RST, M0 e M1 sai da propria placa, entao ESP32 sem
// energia significa driver dormindo.
//
// O LED da placa indica o sentido: acesso num, piscando no outro.
// Se voce plugar o USB, o serial mostra o que esta acontecendo e aceita:
//   p = pausa/retoma    s = solta o motor    + / - = velocidade

#include <Arduino.h>
#include <AccelStepper.h>
#include "pinout.h"

// ----------------------------------------------------------- ajustes
static const float RPM            = 60.0;   // 60 RPM = 1 volta por segundo
static const float ACEL_RPM_S     = 120.0;  // rampa: meio segundo ate a plena
static const unsigned SEGUNDOS    = 10;     // tempo em cada sentido
static const unsigned PAUSA_MS    = 400;    // respiro ao inverter

AccelStepper motor(AccelStepper::DRIVER, PIN_STEP, PIN_DIR);

long pulsosPorSegundo(float rpm) { return (long)(rpm * PULSOS_POR_VOLTA / 60.0); }
long pulsosDoTrecho(float rpm)   { return (long)(rpm / 60.0 * SEGUNDOS * PULSOS_POR_VOLTA); }

void habilita(bool on) { digitalWrite(PIN_ENABLE, on ? LOW : HIGH); }

float rpmAtual = RPM;
int   sentido  = 1;
bool  pausado  = false;
unsigned long marcaPausa = 0;

void novoTrecho() {
  motor.setMaxSpeed(pulsosPorSegundo(rpmAtual));
  motor.setAcceleration(pulsosPorSegundo(ACEL_RPM_S));
  motor.move(sentido * pulsosDoTrecho(rpmAtual));
  Serial.printf("[%lus] girando %s por ~%u s a %.0f RPM\n",
                millis() / 1000, sentido > 0 ? "->" : "<-", SEGUNDOS, rpmAtual);
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  Serial.println();
  Serial.println("=== Alimentador Pet - loop autonomo de motor ===");
  Serial.printf("%u s para cada lado, %.0f RPM, sem parar.\n", SEGUNDOS, RPM);
  Serial.println("serial: p=pausa  s=solta  +/-=velocidade");
  Serial.println();

  habilita(true);
  novoTrecho();
}

void loop() {
  // comandos opcionais, so se alguem plugar o USB
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'p') {
      pausado = !pausado;
      habilita(!pausado);
      Serial.println(pausado ? "pausado" : "retomando");
      if (!pausado) novoTrecho();
    } else if (c == 's') {
      pausado = true; habilita(false);
      Serial.println("motor solto");
    } else if (c == '+') {
      rpmAtual += 15; Serial.printf("velocidade: %.0f RPM\n", rpmAtual);
      motor.setMaxSpeed(pulsosPorSegundo(rpmAtual));
    } else if (c == '-') {
      rpmAtual = max(15.0f, rpmAtual - 15);
      Serial.printf("velocidade: %.0f RPM\n", rpmAtual);
      motor.setMaxSpeed(pulsosPorSegundo(rpmAtual));
    }
  }

  if (pausado) { digitalWrite(PIN_LED, LOW); return; }

  motor.run();

  // LED: aceso num sentido, piscando no outro
  digitalWrite(PIN_LED, sentido > 0 ? HIGH : ((millis() / 300) % 2));

  // fim do trecho: inverte e recomeca
  if (motor.distanceToGo() == 0) {
    if (marcaPausa == 0) {
      marcaPausa = millis();
    } else if (millis() - marcaPausa >= PAUSA_MS) {
      marcaPausa = 0;
      sentido = -sentido;
      novoTrecho();
    }
  }
}
