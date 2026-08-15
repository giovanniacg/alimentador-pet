// WiFi + MQTT sobre WebSocket seguro na porta 443.
//
// Por que NAO usamos o PubSubClient aqui: ele fala MQTT sobre TCP puro e nao
// sabe WebSocket. O broker deste projeto fica atras do Traefik na 443, o que
// exige mqtt-over-wss. O cliente MQTT do proprio ESP-IDF (esp-mqtt), que ja
// vem compilado dentro do core Arduino, fala ws e wss de fabrica e ainda
// traz reconexao automatica e o bundle de CAs (esp_crt_bundle) para validar
// o certificado Let's Encrypt sem embutir PEM no firmware.
#pragma once

#include "comum.h"
#include "ui.h"

struct ComandoMqtt {
  char topico[96];
  char payload[640];
};

void redeIniciar();
void redeLoop();

EstadoRede redeEstado();
bool redeOnline();                      // conectado no broker

// Consome um comando recebido, se houver. O tratamento acontece no loop
// principal, nunca dentro da task do MQTT: dosar bloqueia por dezenas de
// segundos e travaria a pilha de rede.
bool redeProximoComando(ComandoMqtt &c);

// Vira true uma unica vez a cada vez que o WiFi obtem IP. Serve para o
// main disparar a sincronizacao NTP do DS3231.
bool redeConsumirWifiNovo();

// sufixo e o que vem depois de feeder/<id>/ (ex: "state", "event").
void redePublicar(const char *sufixo, const String &payload, bool retained);
