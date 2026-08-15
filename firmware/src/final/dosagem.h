// Dosagem em malha fechada: gira a rosca em incrementos e pesa entre eles
// ate o pote ganhar os gramas pedidos.
//
// Isto e o que separa este aparelho de um temporizador: ele sabe quanto
// realmente caiu, nao quanto deveria ter caido.
#pragma once

#include "comum.h"

Dose dosar(float gramasAlvo);
