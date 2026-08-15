// Agenda local: ate 8 refeicoes {hora, minuto, gramas} na NVS.
//
// Regra inegociavel do projeto: quem decide a hora de comer e o ESP32, nao o
// broker. O MQTT so escreve a agenda; a execucao e sempre local.
#pragma once

#include "comum.h"

void     agendaIniciar();
uint8_t  agendaQuantidade();
Refeicao agendaItem(uint8_t i);

// Substitui a agenda inteira e grava na NVS. Devolve false se a lista veio
// vazia demais ou com hora invalida.
bool agendaDefinir(const Refeicao *lista, uint8_t quantidade);

// Proxima refeicao a partir de agora (rola para o dia seguinte se preciso).
// Devolve false quando nao ha nenhuma agendada.
bool agendaProxima(Refeicao &saida);

// Refeicao vencida que ainda nao foi servida hoje, se houver. A janela de
// atraso evita que uma queda de energia de 3 minutos faca o bicho pular a
// refeicao, e evita servir de novo a refeicao de ontem.
bool agendaVencida(Refeicao &saida, uint8_t &indice, uint16_t janelaMin = 30);

// Marca a refeicao como servida (ou pulada) no dia de hoje. Grava na NVS
// para nao repetir a dose depois de um reboot dentro do mesmo minuto.
void agendaMarcarServida(uint8_t indice);

bool agendaSkipProxima();
void agendaSetSkipProxima(bool v);

String agendaJson();   // espelho publicado em feeder/<id>/schedule
