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
  digitalWrite(PIN_BUZZER, LOW);   // sirene ativa: HIGH ja seria apitar
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

// O buzzer e um modulo ATIVO de 12 V (sirene): tem oscilador proprio e apita
// com corrente continua na entrada. Por isso nada de tone()/noTone() aqui - o
// LEDC do core reclama do canal e o modulo nao toca. Ligar e digitalWrite.
static const uint16_t PULSO_MS = 300;   // duracao do "bip" de feedback

static void segurar(uint32_t ms) {
  digitalWrite(PIN_BUZZER, HIGH);
  uint32_t t0 = millis();
  while (millis() - t0 < ms) { delay(20); yield(); }   // nao segura o watchdog
  digitalWrite(PIN_BUZZER, LOW);
}

static void pulsos(uint8_t quantos, uint16_t intervaloMs) {
  for (uint8_t i = 0; i < quantos; i++) {
    segurar(PULSO_MS);
    if (i + 1 < quantos) delay(intervaloMs);
  }
}

// Aviso de refeicao: chama o cachorro antes de a rosca comecar a girar. A
// duracao vem da config remota (siren_secs), porque quem convive com o
// aparelho e quem sabe quanto barulho e demais.
void sirene(uint8_t segundos) {
  if (segundos == 0) return;
  logf("[sirene] %u s", segundos);
  segurar((uint32_t)segundos * 1000UL);
}

// Os pulsos de feedback sao curtos de proposito: bloqueiam por menos de 2 s e
// sao o unico retorno para quem esta perto do aparelho.
void bipInicioRefeicao() { pulsos(1, 200); }
void bipFimOk()          { pulsos(2, 200); }
void bipFalha()          { pulsos(3, 400); }
