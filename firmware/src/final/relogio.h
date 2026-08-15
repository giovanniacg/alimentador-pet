// DS3231 como fonte da verdade da hora. NTP so serve para ACERTAR o DS3231
// quando ha internet; a agenda nunca depende de estar online.
#pragma once

#include "comum.h"
#include <RTClib.h>

bool     relogioIniciar();
bool     relogioPresente();
DateTime relogioAgora();
bool     relogioSincronizarNtp(uint32_t limiteMs = 8000);  // chamar ao ficar online
String   relogioIso();                                     // 2026-08-15T19:00:00
float    relogioTemperatura();
