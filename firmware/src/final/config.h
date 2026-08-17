// Config remota: tudo que muda o comportamento do aparelho sem regravar
// firmware.
//
// Por que isso existe: o alimentador fica a 1000 km de quem o programou, na
// casa dos pais do Giovanni, e quem convive com ele nao vai abrir o
// PlatformIO. Modo de dosagem, velocidade da rosca, tamanho da dose, teto de
// seguranca e sirene sao todos ajustaveis por MQTT e ficam na NVS.
//
// Fonte da verdade do formato: docs/mqtt.md.
#pragma once

#include "comum.h"
#include <ArduinoJson.h>

void          configIniciar();
const Config &configAtual();
ModoDosagem   configModo();
bool          configModoEhBalanca();          // modo atual usa a celula de carga
const char   *configModoNome(ModoDosagem m);

// Aplica um objeto PARCIAL: so os campos presentes mudam, o resto fica como
// esta. Campo com valor fora da faixa e ignorado e vai para 'rejeitados' com
// o motivo. Devolve true se algo mudou de fato (e ja gravou na NVS).
bool configAplicarParcial(JsonObjectConst obj, JsonArray aplicados, JsonArray rejeitados);

// Forca o modo (usado no boot quando a NVS pede scale e o HX711 nao responde).
void configForcarModo(ModoDosagem m);

String configJson();   // espelho publicado retained em feeder/<id>/config

// Conversao entre os dois jeitos de pedir comida, pelo g_per_s da config.
float configSegundosDe(const Refeicao &r);   // quanto girar no modo timer
float configGramasDe(const Refeicao &r);     // quanto pesar nos modos scale
bool  configPrecisaConverter(const Refeicao &r);   // o pedido veio no campo errado
