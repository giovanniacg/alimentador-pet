// Balanca HX711 sob o pote: leitura em gramas, tara e calibracao.
// O fator de calibracao e o offset da tara ficam na NVS, entao o aparelho
// acorda de uma queda de energia ja sabendo o que e zero.
#pragma once

#include "comum.h"

bool  balancaIniciar();          // false se o HX711 nao responde
bool  balancaPresente();
float balancaGramas(uint8_t amostras = 5);   // leitura filtrada, em gramas
bool  balancaTara();             // zera com o pote como esta agora
bool  balancaCalibrar(float pesoConhecidoG); // com peso padrao sobre o pote
float balancaFator();
