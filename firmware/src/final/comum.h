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
// Segunda rede: o aparelho vive a 1000 km de quem o programou e roda ora na
// casa dos pais, ora na bancada. WiFiMulti tenta as duas e fica na que achar.
#ifndef WIFI_SSID2
  #define WIFI_SSID2 ""
#endif
#ifndef WIFI_PASS2
  #define WIFI_PASS2 ""
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

// Uma refeicao guarda os DOIS jeitos de pedir comida. O app manda um deles
// (secs no modo timer, grams nos modos scale) e o campo que nao veio fica 0.
// Na hora de dosar, o firmware converte pelo g_per_s da config se precisar.
struct Refeicao {
  uint8_t  hora;
  uint8_t  minuto;
  uint16_t gramas;    // 0 = nao informado
  uint16_t segundos;  // 0 = nao informado
};

// --- modos de dosagem ---
// A v1 opera SEM celula de carga: dosagem por TEMPO de rosca girando. Os
// modos scale existem para quando a balanca entrar, e sao ligados por MQTT,
// sem regravar firmware (ninguem estara fisicamente perto do aparelho).
enum class ModoDosagem {
  TIMER,        // gira N segundos, nao pesa nada
  SCALE_BOWL,   // balanca sob o PRATO: dosa ate o peso SUBIR o alvo
  SCALE_HOPPER  // balanca sob o RESERVATORIO: dosa ate o peso DESCER o alvo
};

// --- config remota (NVS + espelho retained em feeder/<id>/config) ---
// Defaults sao os do contrato em docs/mqtt.md.
struct Config {
  ModoDosagem modo;
  uint8_t     rpm;           // velocidade de cruzeiro da rosca, 5..60
  uint16_t    defaultSecs;   // dose do botao fisico / feed sem payload (timer)
  uint16_t    defaultGrams;  // idem nos modos scale
  uint16_t    maxSecs;       // teto de rosca girando por dose, <= 120
  bool        sirene;        // sirene antes de cada refeicao
  uint8_t     sireneSecs;    // duracao do aviso, <= 10
  float       gPorS;         // estimativa gramas/segundo, converte entre modos
};

#define CFG_RPM_MIN         5
#define CFG_RPM_MAX        60
#define CFG_MAX_SECS_TETO 120
#define CFG_SIRENE_TETO    10

// --- dosagem ---
// Resultado de uma tentativa de dosar. Vira evento MQTT e bip no buzzer.
enum class ResultadoDose {
  OK,
  SEM_RACAO,      // so detectavel nos modos scale
  TIMEOUT,
  SEM_BALANCA
};

struct Dose {
  ResultadoDose resultado;
  ModoDosagem   modo;
  float         segundosAlvo;
  float         segundosGirados;
  float         gramasAlvo;
  float         gramasEntregues;   // NAN no modo timer: nao ha como saber
  bool          convertido;        // o alvo veio no campo errado e foi convertido
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
