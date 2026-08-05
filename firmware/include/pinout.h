// Alimentador Pet - mapa de pinos
// Justificativa de cada escolha em docs/pinagem.md
#pragma once

// --- DRV8825 / NEMA 17 ---
#define PIN_STEP        26
#define PIN_DIR         27
#define PIN_ENABLE      25   // ativo em nivel BAIXO

// --- HX711 (celula de carga sob o prato) ---
#define PIN_HX711_DT    16
#define PIN_HX711_SCK    4

// --- Barramento I2C (compartilhado) ---
// RTC e display convivem nos mesmos dois fios, com enderecos distintos.
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define ADDR_DS3231   0x68   // RTC
#define ADDR_OLED     0x3C   // display SSD1306 (algumas placas usam 0x3D)

// --- Display OLED 0.96" SSD1306 ---
// OLED sofre burn-in: nunca deixar conteudo estatico aceso 24/7.
#define OLED_LARGURA   128
#define OLED_ALTURA     64
#define OLED_SLEEP_MS 30000  // apaga sozinho apos 30s sem interacao

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
