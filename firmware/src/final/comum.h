// Alimentador Pet - firmware final: tipos, constantes e segredos
//
// Tudo que mais de um modulo precisa enxergar mora aqui. Os modulos de
// verdade (balanca, motor, relogio, agenda, rede, ui, dosagem) so incluem
// este arquivo e o proprio cabecalho.
//
// Regra do projeto: nenhuma string de log com acento. A serial de 115200
// as vezes engasga com UTF-8 e vira lixo na tela.
#pragma once

#include <Arduino.h>
#include "pinout.h"

// --- segredos ---
// O secrets.h e gitignored. Sem ele o firmware ainda compila (para CI e para
// quem so quer conferir a build), mas nao conecta em lugar nenhum.
#if __has_include("secrets.h")
  #include "secrets.h"
#endif

#ifndef WIFI_SSID
  #define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
  #define WIFI_PASS ""
#endif
#ifndef MQTT_HOST
  #define MQTT_HOST ""
#endif
#ifndef MQTT_PATH
  #define MQTT_PATH "/mqtt"
#endif
#ifndef MQTT_USER
  #define MQTT_USER ""
#endif
#ifndef MQTT_PASS
  #define MQTT_PASS ""
#endif
#ifndef FEEDER_ID
  #define FEEDER_ID "sp01"
#endif

// --- NVS ---
// Um namespace so, curto (o limite do Preferences e 15 caracteres).
#define NVS_NAMESPACE "alimentador"

// --- agenda ---
#define MAX_REFEICOES 8

struct Refeicao {
  uint8_t  hora;
  uint8_t  minuto;
  uint16_t gramas;
};

// --- dosagem ---
// Resultado de uma tentativa de dosar. Vira evento MQTT e bip no buzzer.
enum class ResultadoDose {
  OK,
  SEM_RACAO,
  TIMEOUT,
  SEM_BALANCA
};

struct Dose {
  ResultadoDose resultado;
  float         gramasAlvo;
  float         gramasEntregues;
  uint32_t      duracaoMs;
};

// --- fuso ---
// Regra POSIX fixa de Brasilia. Sem horario de verao desde 2019, entao a
// regra e so o deslocamento. Cuidado com o sinal: em POSIX o offset e o que
// se SOMA ao horario local para chegar em UTC, por isso "3" e nao "-3".
#define TZ_BRASILIA "<-03>3"
#define NTP_SERVIDOR_1 "pool.ntp.org"
#define NTP_SERVIDOR_2 "a.st1.ntp.br"

// --- helpers de log ---
void logf(const char *fmt, ...);
