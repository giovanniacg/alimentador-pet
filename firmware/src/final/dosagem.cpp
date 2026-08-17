#include "dosagem.h"
#include "balanca.h"
#include "motor.h"
#include "config.h"
#include <math.h>

// Incremento de giro entre duas pesagens: um quarto de volta.
static const uint32_t PULSOS_INCREMENTO = PULSOS_POR_VOLTA / 4;   // 400
// Recuo de desentupimento: meia volta ao contrario.
static const uint32_t PULSOS_RECUO      = PULSOS_POR_VOLTA / 2;   // 800

static const float    GANHO_MINIMO_G    = 0.5f;  // abaixo disso e ruido da celula
static const uint8_t  INCR_SEM_GANHO    = 4;     // 1 volta parada = suspeita de travamento
static const uint8_t  MAX_RECUOS        = 3;     // depois disso, desiste

// ---------------------------------------------------------------- timer

// Sem balanca nao existe malha fechada: a rosca gira o tempo pedido e pronto.
// Um entupimento aqui e invisivel para o firmware, e e por isso que o modo
// scale existe. Nunca devolve SEM_RACAO: seria chute.
static Dose dosarPorTempo(float segundos, bool convertido) {
  Dose d = { ResultadoDose::OK, ModoDosagem::TIMER, segundos, 0.0f, NAN, NAN, convertido, 0 };
  uint32_t t0 = millis();

  logf("[dose] modo timer | girar %.1f s a %u rpm", segundos, motorRpm());

  motorHabilitar(true);
  d.segundosGirados = motorGirarPorTempo(segundos, true);
  motorHabilitar(false);   // solta o motor: nada de corrente parada esquentando o driver

  d.duracaoMs = millis() - t0;
  logf("[dose] fim: %.1f s girados em %lu ms", d.segundosGirados, (unsigned long)d.duracaoMs);
  return d;
}

// ---------------------------------------------------------------- scale

static Dose dosarPorPeso(float gramasAlvo, ModoDosagem modo, uint16_t tetoSecs, bool convertido) {
  Dose d = { ResultadoDose::OK, modo, NAN, 0.0f, gramasAlvo, 0.0f, convertido, 0 };
  uint32_t t0 = millis();
  uint32_t timeoutMs = (uint32_t)tetoSecs * 1000UL;

  // No hopper a racao SAI do que esta sendo pesado, entao o delta desce. O
  // sinal aqui e a unica diferenca real entre os dois modos de balanca.
  const float sinal = (modo == ModoDosagem::SCALE_HOPPER) ? -1.0f : 1.0f;

  if (!balancaPresente()) {
    logf("[dose] balanca fora do ar, dosagem cancelada");
    d.resultado = ResultadoDose::SEM_BALANCA;
    return d;
  }

  // Tara implicita: o zero desta dose e o que a celula pesa agora. Assim uma
  // sobra da refeicao anterior nao entra na conta do que vai cair.
  float inicial = balancaGramas(10);
  if (isnan(inicial)) {
    d.resultado = ResultadoDose::SEM_BALANCA;
    return d;
  }
  logf("[dose] modo %s | alvo %.1f g | celula comeca com %.1f g",
       configModoNome(modo), gramasAlvo, inicial);

  motorHabilitar(true);

  float   entregue    = 0.0f;
  float   ultimoPeso  = inicial;
  uint8_t semGanho    = 0;
  uint8_t recuos      = 0;

  while (entregue < gramasAlvo) {
    if (millis() - t0 > timeoutMs) {
      logf("[dose] TIMEOUT com %.1f g de %.1f g (teto de %u s)", entregue, gramasAlvo, tetoSecs);
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

    float ganho = (agora - ultimoPeso) * sinal;
    entregue    = (agora - inicial) * sinal;
    ultimoPeso  = agora;

    if (ganho < GANHO_MINIMO_G) {
      semGanho++;
      if (semGanho >= INCR_SEM_GANHO) {
        semGanho = 0;
        recuos++;
        if (recuos > MAX_RECUOS) {
          logf("[dose] rosca girou e o peso nao mexeu apos %u recuos: sem racao ou entupida", MAX_RECUOS);
          d.resultado = ResultadoDose::SEM_RACAO;
          break;
        }
        logf("[dose] sem variacao de peso, recuo %u/%u para desentupir", recuos, MAX_RECUOS);
        motorGirar(PULSOS_RECUO, false);
      }
    } else {
      semGanho = 0;
    }
  }

  motorHabilitar(false);

  // Leitura final com mais amostras, ja com o motor quieto e sem vibracao.
  delay(300);
  float fim = balancaGramas(10);
  if (!isnan(fim)) entregue = (fim - inicial) * sinal;

  d.gramasEntregues  = entregue < 0 ? 0.0f : entregue;
  d.duracaoMs        = millis() - t0;
  d.segundosGirados  = d.duracaoMs / 1000.0f;
  logf("[dose] fim: %.1f g em %lu ms | resultado=%d",
       d.gramasEntregues, (unsigned long)d.duracaoMs, (int)d.resultado);
  return d;
}

// ---------------------------------------------------------------- entrada

Dose dosar(const Refeicao &pedido) {
  const Config &cfg = configAtual();
  bool convertido = configPrecisaConverter(pedido);

  if (cfg.modo == ModoDosagem::TIMER) {
    return dosarPorTempo(configSegundosDe(pedido), convertido);
  }
  return dosarPorPeso(configGramasDe(pedido), cfg.modo, cfg.maxSecs, convertido);
}
