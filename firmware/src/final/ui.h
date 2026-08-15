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

void bipInicioRefeicao();           // 1 bip curto
void bipFimOk();                    // 2 bips curtos
void bipFalha();                    // 3 bips longos
