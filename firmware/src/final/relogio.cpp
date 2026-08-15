#include "relogio.h"
#include <Wire.h>
#include <time.h>

static RTC_DS3231 rtc;
static bool ok = false;

bool relogioIniciar() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  Wire.beginTransmission(ADDR_DS3231);
  if (Wire.endTransmission() != 0) {
    logf("[relogio] DS3231 nao responde no 0x68 (SDA=%d SCL=%d)", PIN_I2C_SDA, PIN_I2C_SCL);
    ok = false;
    return false;
  }

  ok = rtc.begin();
  if (!ok) { logf("[relogio] respondeu no I2C mas nao inicializou"); return false; }

  if (rtc.lostPower()) {
    logf("[relogio] sem hora valida. Gravando a hora da compilacao ate o NTP chegar.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // Espelha o RTC no relogio interno do ESP32, assim time() tambem funciona
  // antes de qualquer NTP.
  DateTime agora = rtc.now();
  struct tm tmAgora = {};
  tmAgora.tm_year = agora.year() - 1900;
  tmAgora.tm_mon  = agora.month() - 1;
  tmAgora.tm_mday = agora.day();
  tmAgora.tm_hour = agora.hour();
  tmAgora.tm_min  = agora.minute();
  tmAgora.tm_sec  = agora.second();
  tmAgora.tm_isdst = 0;
  setenv("TZ", TZ_BRASILIA, 1);
  tzset();
  time_t epoch = mktime(&tmAgora);
  struct timeval tv = { .tv_sec = epoch, .tv_usec = 0 };
  settimeofday(&tv, nullptr);

  logf("[relogio] ok: %s", relogioIso().c_str());
  return true;
}

bool relogioPresente() { return ok; }

DateTime relogioAgora() {
  if (ok) return rtc.now();
  // Sem DS3231 o aparelho ainda alimenta, usando o relogio interno. Perde a
  // hora numa queda de energia, mas nao vira tijolo.
  time_t agora = time(nullptr);
  struct tm t;
  localtime_r(&agora, &t);
  return DateTime(t.tm_year + 1900, t.tm_mon + 1, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec);
}

bool relogioSincronizarNtp(uint32_t limiteMs) {
  // configTzTime aplica a regra POSIX e dispara o SNTP de uma vez so.
  configTzTime(TZ_BRASILIA, NTP_SERVIDOR_1, NTP_SERVIDOR_2);

  struct tm t;
  uint32_t t0 = millis();
  while (millis() - t0 < limiteMs) {
    if (getLocalTime(&t, 200) && t.tm_year + 1900 > 2024) {
      if (ok) {
        rtc.adjust(DateTime(t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                            t.tm_hour, t.tm_min, t.tm_sec));
      }
      logf("[relogio] NTP ok, DS3231 acertado: %s", relogioIso().c_str());
      return true;
    }
    delay(100);
  }
  logf("[relogio] NTP nao respondeu em %u ms. Seguindo com o DS3231.", limiteMs);
  return false;
}

String relogioIso() {
  DateTime d = relogioAgora();
  char buf[24];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d",
           d.year(), d.month(), d.day(), d.hour(), d.minute(), d.second());
  return String(buf);
}

float relogioTemperatura() { return ok ? rtc.getTemperature() : NAN; }
