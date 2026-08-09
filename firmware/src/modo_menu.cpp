// Alimentador Pet - Fase 02: teste de motor
//
// Objetivo desta fase: provar que o NEMA 17 gira o numero exato de voltas
// pedido, nos dois sentidos, sem esquentar e sem perder passo.
//
// Tres formas de comandar, todas ativas ao mesmo tempo:
//   1. Menu serial (115200) - funciona sempre, mesmo sem WiFi
//   2. Pagina web na rede local - abra o IP no navegador
//   3. OTA - grava versao nova pelo WiFi, sem cabo
//
// O cabo USB e necessario UMA vez, para gravar isto. Depois o OTA assume.

#include <Arduino.h>
#include <AccelStepper.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoOTA.h>
#include "pinout.h"

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #define WIFI_SSID ""
  #define WIFI_PASS ""
#endif

// ---------------------------------------------------------------- motor
AccelStepper motor(AccelStepper::DRIVER, PIN_STEP, PIN_DIR);

float velocidadeRPM = 60.0;   // 1 volta por segundo
float aceleracaoRPMs = 120.0; // chega na velocidade em meio segundo
bool  seguraParado = false;   // manter bobinas energizadas em repouso?

long  pulsosPorSegundo(float rpm) { return (long)(rpm * PULSOS_POR_VOLTA / 60.0); }

void habilita(bool on) {
  // ENABLE do DRV8825 e ativo em nivel BAIXO
  digitalWrite(PIN_ENABLE, on ? LOW : HIGH);
}

void giraVoltas(float voltas) {
  habilita(true);
  motor.setMaxSpeed(pulsosPorSegundo(velocidadeRPM));
  motor.setAcceleration(pulsosPorSegundo(aceleracaoRPMs));
  motor.move((long)(voltas * PULSOS_POR_VOLTA));
}

bool emMovimento() { return motor.distanceToGo() != 0; }

void para() {
  motor.stop();
  motor.setCurrentPosition(motor.currentPosition());
}

// ---------------------------------------------------------------- estado
String ultimaAcao = "nenhuma";

String statusTexto() {
  String s;
  s += "voltas restantes: " + String(motor.distanceToGo() / (float)PULSOS_POR_VOLTA, 2) + "\n";
  s += "velocidade: " + String(velocidadeRPM, 1) + " RPM\n";
  s += "aceleracao: " + String(aceleracaoRPMs, 1) + " RPM/s\n";
  s += "segura parado: " + String(seguraParado ? "sim" : "nao") + "\n";
  s += "ultima acao: " + ultimaAcao + "\n";
  s += "posicao: " + String(motor.currentPosition()) + " pulsos\n";
  return s;
}

// ---------------------------------------------------------------- serial
void ajuda() {
  Serial.println();
  Serial.println("=== Alimentador Pet - teste de motor ===");
  Serial.println("  f        1 volta para frente");
  Serial.println("  t        1 volta para tras");
  Serial.println("  F <n>    n voltas para frente   (ex: F 5)");
  Serial.println("  T <n>    n voltas para tras");
  Serial.println("  v <rpm>  velocidade em RPM      (ex: v 120)");
  Serial.println("  a <rpm>  aceleracao em RPM/s");
  Serial.println("  h        segura parado (bobinas energizadas, faz torque)");
  Serial.println("  s        solta (motor livre, esfria)");
  Serial.println("  p        parar agora");
  Serial.println("  c        ciclo: 1 volta ida e volta, sem parar");
  Serial.println("  i        status");
  Serial.println("  ?        esta ajuda");
  Serial.println();
  Serial.println("Teste de forca: mande 'h' e tente girar o eixo com a mao.");
  Serial.println("Se ceder facil, suba o VREF do driver em 0,05 V e repita.");
  Serial.println();
}

bool ciclando = false;
int  sentidoCiclo = 1;

void executa(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  char c = cmd.charAt(0);
  float arg = cmd.length() > 1 ? cmd.substring(1).toFloat() : 0;

  switch (c) {
    case 'f': ciclando = false; giraVoltas(1);  ultimaAcao = "1 volta frente"; break;
    case 't': ciclando = false; giraVoltas(-1); ultimaAcao = "1 volta tras";   break;
    case 'F': ciclando = false; giraVoltas(arg > 0 ? arg : 1);
              ultimaAcao = String(arg) + " voltas frente"; break;
    case 'T': ciclando = false; giraVoltas(-(arg > 0 ? arg : 1));
              ultimaAcao = String(arg) + " voltas tras"; break;
    case 'v': if (arg > 0) velocidadeRPM = arg;
              ultimaAcao = "velocidade " + String(velocidadeRPM, 1) + " RPM"; break;
    case 'a': if (arg > 0) aceleracaoRPMs = arg;
              ultimaAcao = "aceleracao " + String(aceleracaoRPMs, 1); break;
    case 'h': seguraParado = true;  habilita(true);
              ultimaAcao = "segurando parado"; break;
    case 's': seguraParado = false; habilita(false);
              ultimaAcao = "solto"; break;
    case 'p': ciclando = false; para(); ultimaAcao = "parado"; break;
    case 'c': ciclando = true; sentidoCiclo = 1; giraVoltas(1);
              ultimaAcao = "ciclo continuo"; break;
    case 'i': Serial.print(statusTexto()); break;
    case '?': ajuda(); break;
    default:  Serial.println("comando desconhecido - digite ? para a ajuda"); break;
  }
}

// ---------------------------------------------------------------- web
WebServer server(80);

const char* PAGINA = R"HTML(<!doctype html><meta charset=utf8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Teste de motor</title>
<style>
body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#141a21;color:#e8edf2;
margin:0;padding:20px;max-width:520px;margin:0 auto}
h1{font-size:19px;margin:0 0 4px}p.sub{color:#93a1b0;font-size:13.5px;margin:0 0 18px}
button{font:600 15px/1 inherit;background:#26313d;color:#e8edf2;border:1px solid #2e3a47;
border-radius:9px;padding:14px 10px;cursor:pointer;width:100%}
button:active{background:#ffb454;color:#1a1105}
.g{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:9px}
label{display:block;color:#93a1b0;font-size:13px;margin:16px 0 6px}
input{width:100%;padding:11px;border-radius:9px;border:1px solid #2e3a47;background:#1c242d;
color:#e8edf2;font:15px inherit}
pre{background:#1c242d;border:1px solid #2e3a47;border-radius:9px;padding:12px;
font-size:13px;white-space:pre-wrap;margin-top:18px;color:#93a1b0}
.warn{background:#3a2a12;color:#ffd28a;border-radius:8px;padding:10px 12px;font-size:13px;
margin-bottom:16px;font-weight:600}
</style>
<h1>Teste de motor</h1>
<p class=sub>Alimentador Pet, fase 02</p>
<div class=warn>Desligue a fonte antes de mexer nos fios do motor.</div>
<div class=g>
<button onclick="cmd('f')">1 volta &#9654;</button>
<button onclick="cmd('t')">&#9664; 1 volta</button>
</div>
<div class=g>
<button onclick="cmd('F'+nv())">n voltas &#9654;</button>
<button onclick="cmd('T'+nv())">&#9664; n voltas</button>
</div>
<label>quantas voltas</label><input id=v type=number value=5 min=0.25 step=0.25>
<label>velocidade (RPM)</label><input id=r type=number value=60 min=1 step=5
onchange="cmd('v'+this.value)">
<div class=g3 style="margin-top:16px">
<button onclick="cmd('h')">segurar</button>
<button onclick="cmd('s')">soltar</button>
<button onclick="cmd('p')">parar</button>
</div>
<button onclick="cmd('c')">ciclo continuo (ida e volta)</button>
<pre id=s>carregando...</pre>
<script>
const nv=()=>document.getElementById('v').value;
async function cmd(c){await fetch('/cmd?c='+encodeURIComponent(c));st()}
async function st(){document.getElementById('s').textContent=await (await fetch('/status')).text()}
st();setInterval(st,1200);
</script>)HTML";

void setupWeb() {
  server.on("/", []() { server.send(200, "text/html; charset=utf-8", PAGINA); });
  server.on("/cmd", []() {
    String c = server.arg("c");
    executa(c);
    server.send(200, "text/plain; charset=utf-8", "ok");
  });
  server.on("/status", []() {
    server.send(200, "text/plain; charset=utf-8", statusTexto());
  });
  server.begin();
}

// ---------------------------------------------------------------- setup
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_ENABLE, OUTPUT);
  habilita(false);              // nasce solto: motor frio e livre

  // DRV8825 exige pulso de STEP de no minimo 1,9 us em nivel alto. O padrao do
  // AccelStepper e 1 us, e no ESP32 isso sai curto demais: o driver energiza as
  // bobinas (motor fica duro) mas nao conta passo nenhum. 5 us da folga.
  motor.setMinPulseWidth(5);

  motor.setMaxSpeed(pulsosPorSegundo(velocidadeRPM));
  motor.setAcceleration(pulsosPorSegundo(aceleracaoRPMs));

  ajuda();

  if (strlen(WIFI_SSID) > 0) {
    Serial.print("conectando no WiFi");
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
      delay(400); Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("IP: http://" + WiFi.localIP().toString());
      Serial.println("abra esse endereco no navegador do Mac ou do celular");
      ArduinoOTA.setHostname("alimentador");
      ArduinoOTA.begin();
      setupWeb();
    } else {
      // Sem WiFi o teste continua pelo serial. Nao trava o boot.
      Serial.println("WiFi nao conectou - seguindo so pelo menu serial");
    }
  } else {
    Serial.println("sem credenciais de WiFi - copie include/secrets.h.example");
    Serial.println("para include/secrets.h e preencha. So o menu serial esta ativo.");
  }
}

// ---------------------------------------------------------------- loop
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    ArduinoOTA.handle();
    server.handleClient();
  }

  if (Serial.available()) {
    executa(Serial.readStringUntil('\n'));
  }

  motor.run();

  // fim de movimento: solta as bobinas se nao for para segurar
  static bool moviaAntes = false;
  bool movendo = emMovimento();
  if (moviaAntes && !movendo) {
    if (ciclando) {
      sentidoCiclo = -sentidoCiclo;
      giraVoltas(sentidoCiclo);
    } else if (!seguraParado) {
      habilita(false);
    }
  }
  moviaAntes = movendo;
}
