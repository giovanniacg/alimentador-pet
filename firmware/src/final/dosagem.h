// Dosagem em tres modos, escolhidos pela config remota (docs/mqtt.md):
//
//   timer ........ gira a rosca por N segundos. Nao pesa nada, funciona com o
//                  HX711 desconectado. E o modo da v1.
//   scale_bowl ... balanca sob o PRATO: dosa ate o peso SUBIR o alvo.
//   scale_hopper . balanca sob o RESERVATORIO: dosa ate o peso DESCER o alvo.
//
// Nos modos scale a malha e fechada: o aparelho sabe quanto realmente caiu,
// nao quanto deveria ter caido, e detecta rosca travada ou sem racao. No modo
// timer nao ha como saber, entao "sem_racao" nunca e reportado ali.
#pragma once

#include "comum.h"

// Recebe o pedido cru (com secs, grams ou nenhum dos dois) e resolve o modo,
// a conversao e o teto de seguranca a partir da config vigente.
Dose dosar(const Refeicao &pedido);
