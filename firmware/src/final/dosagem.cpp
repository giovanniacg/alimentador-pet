#include "dosagem.h"
#include "balanca.h"
#include "motor.h"

// Incremento de giro entre duas pesagens: um quarto de volta.
static const uint32_t PULSOS_INCREMENTO = PULSOS_POR_VOLTA / 4;   // 400
// Recuo de desentupimento: meia volta ao contrario.
static const uint32_t PULSOS_RECUO      = PULSOS_POR_VOLTA / 2;   // 800

static const float    GANHO_MINIMO_G    = 0.5f;  // abaixo disso e ruido da celula
static const uint8_t  INCR_SEM_GANHO    = 4;     // 1 volta parada = suspeita de travamento
static const uint8_t  MAX_RECUOS        = 3;     // depois disso, desiste
static const uint32_t TIMEOUT_MS        = 60000;

Dose dosar(float gramasAlvo) {
  Dose d = { ResultadoDose::OK, gramasAlvo, 0.0f, 0 };
  uint32_t t0 = millis();

  if (!balancaPresente()) {
    logf("[dose] balanca fora do ar, dosagem cancelada");
    d.resultado = ResultadoDose::SEM_BALANCA;
    return d;
  }

  // Tara implicita: o zero desta dose e o que o pote pesa agora. Assim uma
  // sobra da refeicao anterior nao entra na conta do que vai cair.
  float inicial = balancaGramas(10);
  if (isnan(inicial)) {
    d.resultado = ResultadoDose::SEM_BALANCA;
    return d;
  }
  logf("[dose] alvo %.1f g | pote comeca com %.1f g", gramasAlvo, inicial);

  motorHabilitar(true);

  float   entregue    = 0.0f;
  float   ultimoPeso  = inicial;
  uint8_t semGanho    = 0;
  uint8_t recuos      = 0;

  while (entregue < gramasAlvo) {
    if (millis() - t0 > TIMEOUT_MS) {
      logf("[dose] TIMEOUT com %.1f g de %.1f g", entregue, gramasAlvo);
      d.resultado = ResultadoDose::TIMEOUT;
      break;
    }

    motorGirar(PULSOS_INCREMENTO, true);

    float agora = balancaGramas(4);
    if (isnan(agora)) {
      logf("[dose] balanca sumiu no meio da dosagem");
      d.resultado = ResultadoDose::SEM_BALANCA;
      break;
    }

    float ganho = agora - ultimoPeso;
    entregue    = agora - inicial;
    ultimoPeso  = agora;

    if (ganho < GANHO_MINIMO_G) {
      semGanho++;
      if (semGanho >= INCR_SEM_GANHO) {
        semGanho = 0;
        recuos++;
        if (recuos > MAX_RECUOS) {
          logf("[dose] rosca girou e o peso nao subiu apos %u recuos: sem racao ou entupida", MAX_RECUOS);
          d.resultado = ResultadoDose::SEM_RACAO;
          break;
        }
        logf("[dose] sem ganho de peso, recuo %u/%u para desentupir", recuos, MAX_RECUOS);
        motorGirar(PULSOS_RECUO, false);
      }
    } else {
      semGanho = 0;
    }
  }

  motorHabilitar(false);   // solta o motor: nada de corrente parada esquentando o driver

  // Leitura final com mais amostras, ja com o motor quieto e sem vibracao.
  delay(300);
  float fim = balancaGramas(10);
  if (!isnan(fim)) entregue = fim - inicial;

  d.gramasEntregues = entregue < 0 ? 0.0f : entregue;
  d.duracaoMs = millis() - t0;
  logf("[dose] fim: %.1f g em %lu ms | resultado=%d",
       d.gramasEntregues, (unsigned long)d.duracaoMs, (int)d.resultado);
  return d;
}
