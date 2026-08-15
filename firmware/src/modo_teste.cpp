// Alimentador Pet - modo TESTE INTEGRADO (o "codigo bobo que testa tudo")
//
// Roda depois da montagem completa da protoboard, antes do firmware final.
// Testa cada componente isoladamente e reporta na serial (115200).
//
// Comandos (uma tecla, sem enter):
//   a  = teste automatico completo, na ordem: LED, buzzer, I2C/RTC, balanca, motor
//   l  = LED           b  = buzzer           r  = relogio DS3231
//   p  = balanca (streaming, qualquer tecla para)   t = tara da balanca
//   m  = motor: 1 volta com rampa            i = resumo geral
//
// Botoes fisicos tambem funcionam o tempo todo:
//   BOTAO_FEED (GPIO 33) = gira o motor 1 volta
//   BOTAO_TARA (GPIO 32) = tara a balanca
//
// Jumpers esperados: M0 e M1 no 3V3 (1/8 de micropasso), SLP+RST no 3V3.

#include <Arduino.h>
#include <Wire.h>
#include <RTClib.h>
#include <HX711.h>
#include "pinout.h"

RTC_DS3231 rtc;
HX711 balanca;

bool rtcOk = false;
bool balancaOk = false;

// ---------- pecas de teste ----------

void testeLed() {
  Serial.println("[LED] piscando 5x o LED azul da placa...");
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_LED, HIGH); delay(150);
    digitalWrite(PIN_LED, LOW);  delay(150);
  }
  Serial.println("[LED] ok se voce viu piscar.");
}

// Sem tone(): o LEDC do core reclama de inicializacao. Bit-bang direto no pino,
// que tambem separa o diagnostico: buzzer ATIVO apita no teste 1 (corrente
// continua), buzzer PASSIVO apita no teste 2 (onda quadrada de 2 kHz).
void testeBuzzer() {
  Serial.println("[BUZZER] teste 1: corrente continua (buzzer ATIVO apita aqui)...");
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(200);
    digitalWrite(PIN_BUZZER, LOW);
    delay(200);
  }
  delay(400);
  Serial.println("[BUZZER] teste 2: onda de 2 kHz (buzzer PASSIVO apita aqui)...");
  for (int i = 0; i < 3; i++) {
    for (int c = 0; c < 400; c++) {          // 400 ciclos a 2 kHz = 200 ms
      digitalWrite(PIN_BUZZER, HIGH);
      delayMicroseconds(250);
      digitalWrite(PIN_BUZZER, LOW);
      delayMicroseconds(250);
    }
    delay(200);
  }
  Serial.println("[BUZZER] apitou no 1 = ativo; no 2 = passivo; em nenhum = conferir");
  Serial.println("[BUZZER]   BC337 (E-B-C, tentar girar 180), resistor 1k e 12V no buzzer.");
}

void testeRtc() {
  Serial.println("[RTC] procurando DS3231 no I2C (SDA=21, SCL=22)...");
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() != 0) {
    Serial.println("[RTC] FALHOU: nada no 0x68. Conferir SDA/SCL, VCC 3V3 e GND do modulo.");
    rtcOk = false;
    return;
  }
  rtcOk = rtc.begin();
  if (!rtcOk) { Serial.println("[RTC] FALHOU: respondeu no I2C mas nao inicializou."); return; }
  if (rtc.lostPower()) {
    Serial.println("[RTC] sem hora valida (bateria nova?). Gravando a hora da compilacao.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  DateTime agora = rtc.now();
  Serial.printf("[RTC] ok: %04d-%02d-%02d %02d:%02d:%02d | temperatura %.1f C\n",
                agora.year(), agora.month(), agora.day(),
                agora.hour(), agora.minute(), agora.second(),
                rtc.getTemperature());
}

void testeBalanca() {
  if (!balanca.is_ready()) {
    Serial.println("[BALANCA] FALHOU: HX711 nao responde (DT=16, SCK=4). Conferir fiacao e VCC.");
    balancaOk = false;
    return;
  }
  balancaOk = true;
  Serial.println("[BALANCA] lendo valor bruto. Aperta no sensor pra ver variar.");
  Serial.println("[BALANCA] qualquer tecla para o streaming.");
  while (Serial.available()) Serial.read();
  while (!Serial.available()) {
    if (balanca.is_ready()) {
      Serial.printf("[BALANCA] bruto: %ld\n", balanca.read());
    }
    delay(250);
  }
  while (Serial.available()) Serial.read();
  Serial.println("[BALANCA] ok se o numero variou quando voce apertou.");
}

void taraBalanca() {
  if (!balanca.is_ready()) { Serial.println("[TARA] HX711 nao responde."); return; }
  balanca.tare(10);
  Serial.println("[TARA] feita (media de 10 leituras).");
}

void testeMotor() {
  Serial.println("[MOTOR] 1 volta horaria com rampa (1/8 de micropasso)...");
  digitalWrite(PIN_ENABLE, LOW);
  digitalWrite(PIN_DIR, LOW);
  delay(5);
  const int total = PASSOS_POR_VOLTA * MICROPASSOS;   // 1600
  for (int i = 0; i < total; i++) {
    // rampa triangular simples: acelera na primeira metade da volta
    unsigned us = 3000;
    if (i < 800) us = 3000 - (unsigned)((3000 - 700) * (long)i / 800);
    else us = 700;
    digitalWrite(PIN_STEP, HIGH);
    delayMicroseconds(us);
    digitalWrite(PIN_STEP, LOW);
    delayMicroseconds(us);
  }
  digitalWrite(PIN_ENABLE, HIGH);   // solta o motor: sem corrente parada, sem esquentar
  Serial.println("[MOTOR] ok se deu exatamente 1 volta e parou solto.");
}

void resumo() {
  Serial.println();
  Serial.println("=== resumo ===");
  Serial.printf("RTC DS3231 ....... %s\n", rtcOk ? "ok" : "FALHOU / nao testado");
  Serial.printf("HX711 balanca .... %s\n", balancaOk ? "ok" : "FALHOU / nao testado");
  Serial.println("LED, buzzer e motor sao de conferencia visual: rode 'a' e observe.");
  Serial.println();
}

void testeAutomatico() {
  Serial.println();
  Serial.println("=== teste automatico: LED -> buzzer -> RTC -> balanca -> motor ===");
  testeLed();
  testeBuzzer();
  testeRtc();
  Serial.println("[BALANCA] checagem rapida (sem streaming):");
  if (balanca.is_ready()) { balancaOk = true; Serial.printf("[BALANCA] ok, bruto: %ld\n", balanca.read()); }
  else { balancaOk = false; Serial.println("[BALANCA] FALHOU: HX711 nao responde."); }
  testeMotor();
  resumo();
}

// ---------- setup / loop ----------

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_ENABLE, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_DRV_WAKE, OUTPUT);
  pinMode(PIN_BOTAO_FEED, INPUT_PULLUP);
  pinMode(PIN_BOTAO_TARA, INPUT_PULLUP);

  digitalWrite(PIN_DRV_WAKE, HIGH);
  digitalWrite(PIN_ENABLE, HIGH);   // motor solto ate alguem pedir
  digitalWrite(PIN_STEP, LOW);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  balanca.begin(PIN_HX711_DT, PIN_HX711_SCK);

  Serial.println();
  Serial.println("=== teste integrado do alimentador ===");
  Serial.println("a=tudo l=led b=buzzer r=relogio p=balanca t=tara m=motor i=resumo");
  Serial.println("Botao FEED = 1 volta | Botao TARA = tara");
  Serial.println();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'a') testeAutomatico();
    else if (c == 'l') testeLed();
    else if (c == 'b') testeBuzzer();
    else if (c == 'r') testeRtc();
    else if (c == 'p') testeBalanca();
    else if (c == 't') taraBalanca();
    else if (c == 'm') testeMotor();
    else if (c == 'i') resumo();
  }

  // botoes fisicos (ativos em LOW, com debounce simples)
  static unsigned long ultimoBotao = 0;
  if (millis() - ultimoBotao > 400) {
    if (digitalRead(PIN_BOTAO_FEED) == LOW) {
      ultimoBotao = millis();
      Serial.println("[BOTAO] FEED apertado.");
      testeMotor();
    }
    if (digitalRead(PIN_BOTAO_TARA) == LOW) {
      ultimoBotao = millis();
      Serial.println("[BOTAO] TARA apertado.");
      taraBalanca();
    }
  }
}
