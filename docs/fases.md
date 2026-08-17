# Fases

Cada fase termina num teste que passa ou não passa. Nenhuma fase começa antes da anterior
fechar.

## Estado do firmware

O firmware final vive em `firmware/src/main.cpp` mais os módulos de
`firmware/src/final/`. Grava com:

```
pio run -e final -t upload
pio device monitor -b 115200
```

Ele cobre **em código** as fases 04, 05 e 06 inteiras. Nenhuma delas está fechada:
fechar exige o teste de bancada descrito em cada uma, com ração e motor de verdade.

### Decisão da v1: sem célula de carga, dosagem por tempo

O aparelho vai operar a 1000 km de quem o programou, na casa dos pais, com público
não técnico e ninguém para mexer em fio. Isso mudou duas coisas de fundo:

1. **A v1 roda sem HX711.** O modo de dosagem padrão é `timer`: a rosca gira N
   segundos e pronto. Se o módulo não responder no boot, o firmware segue normal,
   avisa no log e publica `scale_g: null`. A balança deixou de ser pré-requisito e
   virou upgrade opcional.
2. **Tudo que muda comportamento é configurável por MQTT**, sem regravar firmware:
   modo de dosagem, RPM da rosca, tamanho da dose padrão, teto de segurança por
   dose, sirene e duração do aviso, e o fator gramas/segundo. Tudo persiste na NVS
   e é espelhado retained em `feeder/<id>/config`. Contrato em `docs/mqtt.md`.

Os três modos convivem no mesmo binário (`final/dosagem.cpp`):

| Modo | Como dosa | Detecta ração acabando |
|---|---|---|
| `timer` | gira a rosca por N segundos, não pesa nada | **não** (não há como saber) |
| `scale_bowl` | balança sob o prato, dosa até o peso SUBIR o alvo | sim |
| `scale_hopper` | balança sob o reservatório, dosa até o peso DESCER o alvo | sim |

Pedido em `secs` num modo scale (ou em `grams` no modo timer) é convertido pelo
`g_per_s` da config, e o evento sai marcado com `converted: true`. Trocar para um
modo scale sem HX711 presente é **recusado** com evento explicativo, em vez de
deixar o aparelho incapaz de dosar.

Outras duas mudanças que vieram junto:

- **Sirene, não buzzer musical.** A peça é um módulo ativo de 12 V que apita
  sozinho com corrente contínua. Nada de `tone()` (o LEDC do core reclama do canal
  e simplesmente não toca): o acionamento é `digitalWrite` HIGH no GPIO 17 segurando
  pelo tempo configurado. Os avisos curtos são pulsos de 300 ms.
- **Duas redes WiFi** via `WiFiMulti` (`WIFI_SSID`/`WIFI_SSID2` no `secrets.h`), para
  o aparelho sair da bancada e chegar na casa onde vai morar sem regravação.

| Fase | Coberto pelo `env:final` | Falta |
|---|---|---|
| 04 Dosagem | `final/dosagem.cpp`: modo timer (rosca por tempo, rampa com RPM da config) e modos scale (incrementos de 1/4 de volta, pesagem entre eles, recuo de meia volta ao travar, 3 recuos e desiste, teto `max_secs`, sirene no erro) | medir na bancada **quantos gramas por segundo** a rosca entrega e gravar isso em `g_per_s`; só depois disso a conversão entre modos vale alguma coisa |
| 05 Autonomia | `final/agenda.cpp` (8 refeições na NVS, cada uma com `secs` ou `grams`), `final/relogio.cpp` (DS3231 + NTP com fuso fixo `<-03>3`), botões, sirene, marca a refeição na NVS antes de dosar | teste de crueldade: cortar a tomada no meio do dia |
| 06 Broker | `final/rede.cpp`: esp-mqtt sobre `wss://host:443`, keepalive 45 s, LWT retained, reconexão automática, CA bundle do próprio core, WiFiMulti com duas redes | subir o Mosquitto atrás do Traefik e alimentar pelo 4G |

Pendências conhecidas: medir `g_per_s` com ração de verdade (é o número que sustenta
a dosagem por tempo inteira); conferir na bancada se o RPM default de 20 vence a
ração sem travar; e, se e quando a célula de carga entrar, medir o fator de
calibração na peça real (`c <gramas>` na serial).

---

## Fase 00 — Bancada

**Fecha quando:** o LED da placa pisca com código seu.

- Instalar PlatformIO (extensão do VS Code ou `pip install platformio`)
- Gravar o primeiro programa na ESP32 e ver o LED piscar
- Clonar este repositório e confirmar que `firmware/` compila
- Separar as peças e conferir a lista do README

Se a placa não for reconhecida no USB, quase sempre falta o driver CP210x ou CH340
(depende do chip serial da sua placa).

---

## Fase 01 — Energia

**Fecha quando:** o multímetro lê 5,0 V na saída do LM2596 e 3,3 V no pino da placa.

- Montar o trilho de 12 V a partir do conector P4
- Ajustar o LM2596 **antes** de conectar qualquer coisa na saída dele
- Fechar o terra comum e conferir continuidade

O LM2596 sai de fábrica em tensão arbitrária, às vezes 12 V direto. Ajustar depois de
conectar o ESP32 significa queimar o ESP32.

---

## Fase 02 — Motor gira

**Fecha quando:** o eixo dá exatamente uma volta e para, sem esquentar.

- Montar o driver com o capacitor de 470 µF junto aos pinos VMOT/GND
- Ligar os jumpers de RESET e SLEEP em 3,3 V
- Ajustar VREF para 0,70 V com o motor desconectado (1,4 A; o nominal do motor é 1,5 A)
- Girar 1600 pulsos (uma volta em 1/8 de micropasso) e conferir
- Testar os dois sentidos

Se o motor apenas vibra sem girar, quase sempre é par de bobinas trocado. Meça a
continuidade: os fios de um mesmo par têm baixa resistência entre si.

### Dois firmwares para esta fase

| Modo | Grava com | Para quê |
|---|---|---|
| `loop` | `pio run -e loop -t upload` | Liga na tomada e gira sozinho, 10 s de cada lado, para sempre. Teste de campo e de resistência, sem computador por perto. |
| `menu` | `pio run -e menu -t upload` | Comandos por serial (`f`, `t`, `F 5`, `v 120`, `h`) e página web. Para investigar com precisão. |

### Rodando sem USB

Os três precisam estar ligados, ou nada acontece:

1. **12 V da fonte** no `UMOT` do driver
2. **5 V do LM2596** no `VIN` do ESP32
3. **GND comum** entre fonte, driver e placa

O item 2 é o que se esquece. Sem ele o ESP32 não liga, e sem ESP32 não há 3,3 V para
segurar `SLP`, `RST`, `M0` e `M1` — o driver fica dormindo e o motor não se move, mesmo
com os 12 V presentes e tudo parecendo certo.

---

## Fase 03 — Balança e calibração

> **Opcional na v1.** A v1 opera sem célula de carga, no modo `timer`. Esta fase virou
> upgrade: fecha quando a balança entrar, e o modo scale é ligado por MQTT, sem
> regravar firmware. O que **não** é opcional é medir os gramas por volta da rosca:
> sem esse número, `g_per_s` é chute e a dosagem por tempo não tem escala.

**Fecha quando:** a leitura bate com um peso conhecido dentro de ±2 g.

- Ligar o HX711 em 3,3 V e obter leitura bruta estável
- Tarar (zerar) com o prato vazio
- Calibrar com objeto de peso conhecido e gravar o fator na NVS
- Montar a rosca e medir **quantos gramas saem por volta**

O número de gramas por volta é o coração do projeto. Antes dele, dosagem é chute; depois
dele, o resto é software. Meça pelo menos cinco voltas e tire a média.

---

## Fase 04 — Dosagem

**Fecha na v1 quando:** girar 8 s entrega uma porção repetível (mesmo tempo, mesma
quantidade dentro de uma margem aceitável para um cachorro), com `g_per_s` medido e
gravado na config.

- Medir gramas por segundo de rosca girando, com o funil cheio e com o funil pela metade
- Ajustar `rpm` por MQTT até achar a velocidade que não trava a ração
- Conferir que o teto `max_secs` corta uma dose que passou do ponto

**Fecha na v2 (com célula) quando:** pedir 80 g entrega 80 g, e a rosca travada é
detectada em 5 s.

- Girar em incrementos (por exemplo, um quarto de volta), pesando entre eles, até o alvo
- Detectar entupimento: girou e o peso não subiu, logo travou
- Ao travar, recuar meia volta e tentar de novo
- Após três falhas, acionar o buzzer e registrar o erro

A malha fechada é o que diferencia esse alimentador de um temporizador: ele sabe quanto
realmente caiu, não quanto deveria ter caído. A v1 abre mão disso de propósito, em troca
de funcionar sem nenhuma peça a mais e sem ninguém por perto para consertar. O caminho de
volta está pronto no firmware: basta ligar a célula e mandar um `cmd/config`.

---

## Fase 05 — Autonomia

**Fecha quando:** com o cabo de rede arrancado, ele alimenta no horário certo.

- WiFi e sincronismo de hora por NTP
- RTC DS3231 como reserva quando não há internet
- Agenda gravada na NVS, sobrevivendo a queda de energia
- Botão físico disparando dose manual
- Buzzer chamando o animal antes de servir
- **Teste de crueldade:** desligue a tomada no meio do dia e confira se acorda correto

Esta é a fase que cumpre o princípio do projeto. Não pule o teste de crueldade.

---

## Fase 06 — Broker e conexão

**Fecha quando:** alimentar pelo celular, no 4G, fora de casa.

- Subir o Mosquitto com usuário, senha e ACL por tópico (veja `infra/`)
- Publicar via Traefik com TLS
- Firmware conectando por WebSocket seguro, keepalive de 45 s, reconexão automática
- *Last will* configurado: o broker anuncia quando o alimentador some

O keepalive de 45 s não é detalhe: a Cloudflare encerra WebSocket ocioso perto de 100 s, e
sem isso a conexão cai de forma intermitente e parece bug de firmware.

---

## Fase 07 — Aplicativo

**Fecha quando:** alguém usa sem você explicar.

- Tela única: peso no prato, próxima refeição, botão grande de alimentar
- Agenda com horários e porções
- Pular a próxima refeição
- Histórico do que foi servido e do que foi comido
- Login com usuário e senha
- Gerar o APK pelo Expo

O teste real é entregar o celular para alguém que não participou do projeto e ver se a
pessoa alimenta sem perguntar nada.

---

## Fase 08 — Campo

**Fecha quando:** funciona sozinho por sete dias.

- Sair da protoboard para placa fixa e caixa fechada
- Instalar no local e calibrar ali (a rosca se comporta diferente com o funil cheio)
- Ensinar o botão manual a quem convive com o aparelho
- Observar uma semana antes de considerar pronto

Um alimentador que funcionou três dias não funcionou. Sete dias sem intervenção é o mínimo
para confiar num aparelho do qual um animal depende.
