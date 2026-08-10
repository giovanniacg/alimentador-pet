# Fases

Cada fase termina num teste que passa ou não passa. Nenhuma fase começa antes da anterior
fechar.

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

**Fecha quando:** a leitura bate com um peso conhecido dentro de ±2 g.

- Ligar o HX711 em 3,3 V e obter leitura bruta estável
- Tarar (zerar) com o prato vazio
- Calibrar com objeto de peso conhecido e gravar o fator na NVS
- Montar a rosca e medir **quantos gramas saem por volta**

O número de gramas por volta é o coração do projeto. Antes dele, dosagem é chute; depois
dele, o resto é software. Meça pelo menos cinco voltas e tire a média.

---

## Fase 04 — Dosagem em malha fechada

**Fecha quando:** pedir 80 g entrega 80 g, e a rosca travada é detectada em 5 s.

- Girar em incrementos (por exemplo, um quarto de volta), pesando entre eles, até o alvo
- Detectar entupimento: girou e o peso não subiu, logo travou
- Ao travar, recuar meia volta e tentar de novo
- Após três falhas, acionar o buzzer e registrar o erro

A malha fechada é o que diferencia esse alimentador de um temporizador: ele sabe quanto
realmente caiu, não quanto deveria ter caído.

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
