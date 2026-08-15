#include "ui.h"

static bool     nivelAnterior[2] = { HIGH, HIGH };
static uint32_t ultimoQuique[2]  = { 0, 0 };
static const uint8_t PINO[2]     = { PIN_BOTAO_FEED, PIN_BOTAO_TARA };

void uiIniciar() {
  pinMode(PIN_BOTAO_FEED, INPUT_PULLUP);
  pinMode(PIN_BOTAO_TARA, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED, LOW);
}

EventoBotao uiBotao() {
  for (uint8_t i = 0; i < 2; i++) {
    bool nivel = digitalRead(PINO[i]);
    if (nivel == nivelAnterior[i]) continue;
    if (millis() - ultimoQuique[i] < DEBOUNCE_MS) continue;

    ultimoQuique[i]  = millis();
    nivelAnterior[i] = nivel;
    if (nivel == LOW) {   // botao ativo em nivel baixo: aperto e a borda de descida
      return i == 0 ? EventoBotao::FEED : EventoBotao::TARA;
    }
  }
  return EventoBotao::NENHUM;
}

void uiLoop(EstadoRede rede) {
  static uint32_t ultimo = 0;
  static bool aceso = false;

  if (rede == EstadoRede::ONLINE) {
    if (!aceso) { digitalWrite(PIN_LED, HIGH); aceso = true; }
    return;
  }

  uint32_t periodo = (rede == EstadoRede::SEM_WIFI) ? 150 : 700;
  if (millis() - ultimo >= periodo) {
    ultimo = millis();
    aceso = !aceso;
    digitalWrite(PIN_LED, aceso ? HIGH : LOW);
  }
}

// Os bips sao curtos de proposito: bloqueiam por menos de 1 s e sao o unico
// aviso de quem esta perto do aparelho.
void bipInicioRefeicao() {
  tone(PIN_BUZZER, 2200, 120);
  delay(160);
  noTone(PIN_BUZZER);
}

void bipFimOk() {
  for (int i = 0; i < 2; i++) {
    tone(PIN_BUZZER, 2600, 90);
    delay(150);
  }
  noTone(PIN_BUZZER);
}

void bipFalha() {
  for (int i = 0; i < 3; i++) {
    tone(PIN_BUZZER, 900, 300);
    delay(400);
  }
  noTone(PIN_BUZZER);
}
