#include "rede.h"
#include <WiFi.h>
#include "mqtt_client.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

// O bundle de CAs publicas ja vem compilado dentro da libmbedtls do core.
// Nao da para incluir "esp_crt_bundle.h" direto: o header da biblioteca
// WiFiClientSecure do Arduino tem o mesmo nome, chega antes no caminho de
// include e so declara a variante renomeada (arduino_esp_crt_bundle_attach),
// que nao serve para o esp-mqtt. Declarar o simbolo do IDF aqui resolve sem
// mexer no core.
extern "C" esp_err_t esp_crt_bundle_attach(void *conf);

static esp_mqtt_client_handle_t cliente = nullptr;
static QueueHandle_t filaComandos = nullptr;

static bool wifiOk        = false;
static bool brokerOk      = false;
static bool wifiNovo      = false;
static bool mqttIniciado  = false;
static uint32_t ultimaTentativaWifi = 0;

static char baseTopico[64];
static char topicoState[80];
static char topicoCmd[80];
static char uriBroker[160];
static char clientId[32];

static const char *LWT_PAYLOAD = "{\"online\":false}";

// ---------------------------------------------------------------- MQTT

static void aoConectar() {
  brokerOk = true;
  logf("[mqtt] conectado em %s", uriBroker);
  esp_mqtt_client_subscribe(cliente, topicoCmd, 1);
}

static void aoReceber(esp_mqtt_event_handle_t e) {
  if (!filaComandos) return;
  ComandoMqtt c = {};
  size_t nt = e->topic_len < sizeof(c.topico) - 1 ? e->topic_len : sizeof(c.topico) - 1;
  size_t np = e->data_len  < sizeof(c.payload) - 1 ? e->data_len  : sizeof(c.payload) - 1;
  memcpy(c.topico, e->topic, nt);
  memcpy(c.payload, e->data, np);
  // Mensagem que nao coube na fila e melhor perdida do que travando a pilha
  // de rede: o app sempre pode mandar de novo.
  xQueueSend(filaComandos, &c, 0);
}

static void tratador(void *args, esp_event_base_t base, int32_t id, void *dados) {
  esp_mqtt_event_handle_t e = (esp_mqtt_event_handle_t)dados;
  switch ((esp_mqtt_event_id_t)id) {
    case MQTT_EVENT_CONNECTED:    aoConectar(); break;
    case MQTT_EVENT_DISCONNECTED: brokerOk = false; logf("[mqtt] caiu, o cliente vai tentar de novo sozinho"); break;
    case MQTT_EVENT_DATA:         aoReceber(e); break;
    case MQTT_EVENT_ERROR:        logf("[mqtt] erro de transporte"); break;
    default: break;
  }
}

static void mqttIniciar() {
  if (mqttIniciado) return;
  if (strlen(MQTT_HOST) == 0) {
    logf("[mqtt] MQTT_HOST vazio no secrets.h, ficando so no modo local");
    return;
  }

  esp_mqtt_client_config_t cfg = {};
  cfg.uri                 = uriBroker;
  cfg.client_id           = clientId;
  cfg.username            = MQTT_USER;
  cfg.password            = MQTT_PASS;
  cfg.keepalive           = 45;          // abaixo dos ~100 s de timeout de WS ocioso
  cfg.lwt_topic           = topicoState;
  cfg.lwt_msg             = LWT_PAYLOAD;
  cfg.lwt_qos             = 1;
  cfg.lwt_retain          = 1;
  cfg.disable_clean_session = false;
  cfg.reconnect_timeout_ms  = 5000;
  cfg.crt_bundle_attach   = esp_crt_bundle_attach;   // CAs publicas, cobre Let's Encrypt

  cliente = esp_mqtt_client_init(&cfg);
  if (!cliente) { logf("[mqtt] falhou ao criar o cliente"); return; }

  esp_mqtt_client_register_event(cliente, (esp_mqtt_event_id_t)ESP_EVENT_ANY_ID, tratador, nullptr);
  esp_mqtt_client_start(cliente);
  mqttIniciado = true;
  logf("[mqtt] cliente iniciado, keepalive 45 s");
}

// ---------------------------------------------------------------- WiFi

static void conectarWifi() {
  if (strlen(WIFI_SSID) == 0) return;
  logf("[wifi] conectando em %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

// ---------------------------------------------------------------- API

void redeIniciar() {
  snprintf(baseTopico,  sizeof(baseTopico),  "feeder/%s", FEEDER_ID);
  snprintf(topicoState, sizeof(topicoState), "%s/state", baseTopico);
  snprintf(topicoCmd,   sizeof(topicoCmd),   "%s/cmd/#", baseTopico);
  snprintf(clientId,    sizeof(clientId),    "feeder-%s", FEEDER_ID);
  snprintf(uriBroker,   sizeof(uriBroker),   "wss://%s:443%s", MQTT_HOST, MQTT_PATH);

  filaComandos = xQueueCreate(4, sizeof(ComandoMqtt));
  conectarWifi();
  ultimaTentativaWifi = millis();
}

void redeLoop() {
  bool agora = (WiFi.status() == WL_CONNECTED);

  if (agora && !wifiOk) {
    wifiOk = true;
    wifiNovo = true;
    logf("[wifi] conectado | ip=%s rssi=%d", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    mqttIniciar();
  } else if (!agora && wifiOk) {
    wifiOk = false;
    brokerOk = false;
    logf("[wifi] caiu");
  }

  // Retentativa periodica. Nada de while esperando: o aparelho tem que
  // continuar alimentando mesmo com o roteador desligado.
  if (!agora && millis() - ultimaTentativaWifi > 20000) {
    ultimaTentativaWifi = millis();
    WiFi.disconnect();
    conectarWifi();
  }
}

EstadoRede redeEstado() {
  if (!wifiOk)   return EstadoRede::SEM_WIFI;
  if (!brokerOk) return EstadoRede::SEM_BROKER;
  return EstadoRede::ONLINE;
}

bool redeOnline() { return brokerOk; }

bool redeProximoComando(ComandoMqtt &c) {
  if (!filaComandos) return false;
  return xQueueReceive(filaComandos, &c, 0) == pdTRUE;
}

bool redeConsumirWifiNovo() {
  if (!wifiNovo) return false;
  wifiNovo = false;
  return true;
}

void redePublicar(const char *sufixo, const String &payload, bool retained) {
  if (!cliente || !brokerOk) return;
  char topico[96];
  snprintf(topico, sizeof(topico), "%s/%s", baseTopico, sufixo);
  esp_mqtt_client_publish(cliente, topico, payload.c_str(), payload.length(), 1, retained ? 1 : 0);
}
