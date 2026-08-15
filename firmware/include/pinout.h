// Alimentador Pet - mapa de pinos
// Justificativa de cada escolha em docs/pinagem.md
//
// PLACA: ESP32 DevKit de 38 pinos. Os GPIOs usados aqui sao os mesmos de uma
// placa de 30 pinos, mas a POSICAO FISICA deles na placa e outra - conferir o
// mapa em hardware/montagem-protoboard.html antes de montar.
//
// NAO USAR: D0 D1 D2 D3 CMD CLK (GPIO 6-11) sao a memoria flash. Fio neles e a
// placa nao le o proprio firmware. Nesta placa o pino de alimentacao externa
// chama 5V (nao VIN) e fica colado no CMD.
#pragma once

// --- DRV8825 / NEMA 17 ---
// Serigrafia da placa: STP, DIR, EN. Nao existe VDD (logica vem do UMOT).
// SLP+RST jumpeados no 3V3; M0+M1 no 3V3 e M2 solto = 1/8 de micropasso.
// Bobinas: 1A com 1B, 2A com 2B - nunca 1A com 2A.
#define PIN_STEP        26   // -> STP
#define PIN_DIR         27   // -> DIR
#define PIN_ENABLE      25   // -> EN, ativo em nivel BAIXO
// Fonte de nivel alto para SLP e RST do driver, alternativa ao fio do 3V3.
// Util quando o caminho do 3V3 esta em duvida: o firmware garante o HIGH.
#define PIN_DRV_WAKE    14   // -> SLP e RST

// --- HX711 (celula de carga sob o prato) ---
#define PIN_HX711_DT    16
#define PIN_HX711_SCK    4

// --- Barramento I2C ---
// Hoje so o RTC. O barramento aceita mais modulos em paralelo quando precisar
// (display OLED estudado e adiado - ver docs/pinagem.md).
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define ADDR_DS3231   0x68   // RTC

// --- Buzzer 12V via BC337 ---
#define PIN_BUZZER      17   // sempre com 1k em serie na base

// --- Interface fisica ---
// Botoes inox 12mm IP66, momentaneos (NA). INPUT_PULLUP, outro lado no GND.
#define PIN_BOTAO_FEED  33   // frente:  toque = alimentar | 5s = config WiFi
#define PIN_BOTAO_TARA  32   // atras:   toque = zerar balanca (prato vazio)
#define PIN_LED          2   // LED onboard

#define DEBOUNCE_MS     50
#define HOLD_MS       5000   // limiar de "segurar"

// --- Mecanica ---
#define PASSOS_POR_VOLTA      200
#define MICROPASSOS             8   // MS0=1 MS1=1 MS2=0
#define PULSOS_POR_VOLTA      (PASSOS_POR_VOLTA * MICROPASSOS)  // 1600
