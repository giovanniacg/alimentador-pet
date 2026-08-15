// Rosca sem-fim: DRV8825 + NEMA 17 em 1/8 de micropasso.
//
// A rampa aqui e a validada na bancada (modo_rampa / modo_teste): o pulso
// comeca com meio-periodo de 3000 us e fecha em 700 us. Motor de passo nao
// parte direto na velocidade final, perde sincronismo e vibra parado.
//
// O ENABLE fica DESLIGADO fora da dosagem. Segurar corrente com o motor
// parado nao serve para nada aqui e esquenta o driver a toa.
#pragma once

#include "comum.h"

void motorIniciar();
void motorHabilitar(bool ligado);
bool motorHabilitado();

// Gira um lote de pulsos com rampa interna. Bloqueia enquanto gira: e curto
// (fracao de volta) e e o trabalho real do aparelho.
// horario = true entrega racao; false e o recuo de desentupimento.
void motorGirar(uint32_t pulsos, bool horario);
