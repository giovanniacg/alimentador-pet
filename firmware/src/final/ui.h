// Interface fisica: dois botoes, buzzer e LED.
//
// LED conta a conexao sem ninguem precisar abrir o app:
//   aceso            = conectado no broker
//   pisca devagar    = WiFi ok, broker fora
//   pisca rapido     = sem WiFi
#pragma once

#include "comum.h"

enum class EstadoRede { SEM_WIFI, SEM_BROKER, ONLINE };

enum class EventoBotao { NENHUM, FEED, TARA };

void uiIniciar();
void uiLoop(EstadoRede rede);       // so cuida do LED, nao bloqueia
EventoBotao uiBotao();              // consome um evento de botao, se houver

// O buzzer deste projeto e um MODULO ATIVO de 12 V, tipo sirene: apita
// sozinho com corrente continua na entrada. Nao se usa tone() nele - alem de
// nao adiantar (o modulo tem oscilador proprio), o LEDC do core Arduino
// reclama do canal e simplesmente nao toca. O acionamento e digitalWrite HIGH
// segurando pelo tempo desejado.
void sirene(uint8_t segundos);      // aviso antes da refeicao, duracao da config
void bipInicioRefeicao();           // 1 pulso de 300 ms
void bipFimOk();                    // 2 pulsos de 300 ms
void bipFalha();                    // 3 pulsos de 300 ms
