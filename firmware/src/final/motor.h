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

// Velocidade de cruzeiro em RPM do eixo, vinda da config remota (5..60).
// So mexe no PATAMAR: o arranque lento validado na bancada continua igual,
// porque e ele que evita o motor perder sincronismo e vibrar parado.
void motorSetRpm(uint8_t rpm);
uint8_t motorRpm();

// Gira um lote de pulsos com rampa interna. Bloqueia enquanto gira: e curto
// (fracao de volta) e e o trabalho real do aparelho.
// horario = true entrega racao; false e o recuo de desentupimento.
void motorGirar(uint32_t pulsos, bool horario);

// Gira pelo TEMPO pedido, com a mesma rampa. E o coracao do modo timer: sem
// balanca, o unico jeito de dosar e contar segundos de rosca girando.
// Devolve os segundos realmente girados.
float motorGirarPorTempo(float segundos, bool horario);
