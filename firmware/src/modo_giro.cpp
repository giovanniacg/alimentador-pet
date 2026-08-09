// Alimentador Pet - modo GIRO CONTINUO (diagnostico)
//
// Gira em UM sentido so, sem parar, em velocidade constante.
// Feito para investigar "o motor vibra mas nao gira".
//
// Comeca devagar de proposito: 15 RPM. Motor de passo tem muito mais torque em
// baixa velocidade, entao se o problema for corrente no limite, aqui ele gira.
// Suba com '+' ate achar onde falha - esse ponto e o diagnostico:
//
//   nao gira nem a 15 RPM ......... caminho eletrico: VREF muito baixo,
//                                   bobina aberta ou contato ruim
//   gira devagar, falha ao subir .. corrente insuficiente: aumente o VREF
//   gira redondo ate 120+ RPM ..... esta tudo certo
//
// Serial (115200):
//   +   sobe 5 RPM        -   desce 5 RPM
//   d   inverte o sentido  p   pausa/retoma
//   s   solta o motor      i   status

#include <Arduino.h>
#include <AccelStepper.h>
#include "pinout.h"

static const float RPM_INICIAL = 15.0;   // devagar de proposito
static const float PASSO_RPM   = 5.0;

AccelStepper motor(AccelStepper::DRIVER, PIN_STEP, PIN_DIR);

float rpm     = RPM_INICIAL;
int   sentido = 1;
bool  parado  = false;

long pulsosPorSegundo(float r) { return (long)(r * PULSOS_POR_VOLTA / 60.0); }
void habilita(bool on) { digitalWrite(PIN_ENABLE, on ? LOW : HIGH); }

void aplica() {
  motor.setMaxSpeed(pulsosPorSegundo(rpm) * 2);
  motor.setSpeed(sentido * pulsosPorSegundo(rpm));
  Serial.printf("%.0f RPM, sentido %s, %ld pulsos/s\n",
                rpm, sentido > 0 ? "->" : "<-", pulsosPorSegundo(rpm));
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  // DRV8825 exige pulso de STEP de no minimo 1,9 us em nivel alto. O padrao do
  // AccelStepper e 1 us, e no ESP32 isso sai curto demais: o driver energiza as
  // bobinas (motor fica duro) mas nao conta passo nenhum. 5 us da folga.
  motor.setMinPulseWidth(5);

  digitalWrite(PIN_LED, HIGH);

  Serial.println();
  Serial.println("=== giro continuo - diagnostico ===");
  Serial.println("+ sobe 5 RPM | - desce | d inverte | p pausa | s solta | i status");
  Serial.println();
  Serial.println("Se nem a 15 RPM girar, o problema e eletrico:");
  Serial.println("  VREF baixo, bobina aberta ou contato ruim na protoboard.");
  Serial.println();

  habilita(true);
  aplica();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '+') { rpm += PASSO_RPM; aplica(); }
    else if (c == '-') { rpm = max(1.0f, rpm - PASSO_RPM); aplica(); }
    else if (c == 'd') { sentido = -sentido; aplica(); }
    else if (c == 'p') {
      parado = !parado; habilita(!parado);
      Serial.println(parado ? "pausado" : "girando");
      if (!parado) aplica();
    }
    else if (c == 's') { parado = true; habilita(false); Serial.println("motor solto"); }
    else if (c == 'i') {
      Serial.printf("rpm=%.0f sentido=%d parado=%d posicao=%ld\n",
                    rpm, sentido, parado, motor.currentPosition());
    }
  }

  if (parado) { digitalWrite(PIN_LED, LOW); return; }

  // runSpeed mantem velocidade constante, sem rampa: e o que se quer aqui
  motor.runSpeed();
  digitalWrite(PIN_LED, (millis() / 500) % 2);
}
