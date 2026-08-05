# Alimentador Pet

Alimentador automático de ração com dosagem por peso, controlado por aplicativo.

Rosca sem-fim acionada por motor de passo, célula de carga sob o prato fechando a malha
de controle, ESP32 com agenda própria e um app React Native para configurar tudo de longe.

> **Status:** fase 00 (bancada). Projeto em construção, documentado passo a passo.

---

## O princípio que governa o projeto

**O agendamento mora no ESP32, nunca no servidor.**

Os horários ficam gravados na memória não-volátil da placa e o firmware dispara a dose
sozinho, usando o relógio interno. O MQTT é apenas a camada de controle e telemetria.

O motivo é simples: entre o alimentador e o servidor existem o roteador da casa, o provedor
local, a internet, a VPS e o Docker. Cinco pontos de falha em série. Se qualquer decisão de
alimentar depender dessa corrente, uma queda de internet num domingo vira um animal sem comer.

Com a agenda local, tudo isso pode cair ao mesmo tempo e a ração continua saindo no horário.
O que se perde é o controle remoto, que é o recurso descartável.

Consequência: o RTC com bateria e o botão físico são peças **obrigatórias**, não opcionais.

---

## Arquitetura

```
   SÃO PAULO (casa)                        BRASÍLIA (VPS)
   ┌────────────────────┐                  ┌────────────────────┐
   │ Alimentador        │                  │ Mosquitto          │
   │ ESP32 + NEMA17     │◄──── wss:// ────►│ atrás do Traefik   │
   │ HX711 + DS3231     │      :443        │ TLS + user/senha   │
   │ agenda na NVS      │                  └────────┬───────────┘
   └────────────────────┘                           │
   ┌────────────────────┐                           │
   │ Botão físico       │                  ┌────────▼───────────┐
   │ dose sem app/rede  │                  │ App (APK)          │
   └────────────────────┘                  └────────────────────┘
```

MQTT sobre WebSocket seguro na porta 443. Nenhuma porta nova exposta, certificado curinga
já existente, e do lado da instalação não há nada a configurar: liga e conecta.

**Keepalive de 45 s** nos dois clientes — a Cloudflare encerra WebSocket ocioso perto de 100 s.

---

## Materiais

### Já em mãos

| Item | Função |
|---|---|
| ESP32-WROOM-32 | Cérebro: WiFi, MQTT, agenda local, controle do motor |
| NEMA 17 · 4,2 kgf·cm | Gira a rosca sem-fim |
| DRV8825 + dissipador | Driver do motor, corrente ajustável e micropasso |
| Célula de carga 5 kg + HX711 | Pesa o prato, fecha a malha de dosagem |
| Fonte 12 V · 5 A | Alimentação geral |
| LM2596 (2 un.) | Rebaixa 12 V para 5 V |
| Buzzer 12 V iluminado | Chama o animal e sinaliza falha |
| Capacitor 470 µF / 35 V | Estabiliza a alimentação do driver |
| Protoboard, jumpers, resistores, conectores P4 | Montagem de bancada |

### A comprar (~R$ 75)

| Item | Por quê |
|---|---|
| BC337 (NPN) | Chaveia o buzzer de 12 V pelo GPIO de 3,3 V. **Não use IRFZ44N** — não é logic level, não satura com 3,3 V |
| 1N4007 | Diodo de proteção contra pico indutivo |
| RTC DS3231 | Relógio com bateria. Sem ele, após queda de energia sem internet a placa não sabe a hora e não alimenta |
| 2x Botão inox 12 mm IP66 | Dose manual sem app/rede e tara da balança. IP66 aguenta respingo na área do comedouro |

### Estudado e adiado

**Display OLED 0,96" SSD1306.** Entraria no I²C que já existe, sem peça adicional nem GPIO
novo. Adiado por não haver função definida para a tela: OLED sofre burn-in, então o
comportamento dela (quando acende, quando dorme, o que mostra) precisa ser decidido antes
da compra, não depois. Notas técnicas guardadas em [`docs/pinagem.md`](docs/pinagem.md).

**Câmera.** Um ESP32-CAM apontado para o comedouro transformaria "alimentei" em "vi ele
comendo". É um segundo aparelho e um projeto próprio, não um módulo a mais. Só faz sentido
depois que este aqui rodar sete dias em pé.

### Em aberto

A rosca sem-fim e o funil. Pode ser impresso em 3D (`auger screw` de 20-25 mm, furo de 5 mm),
broca de trado adaptada ou saca-rolha de metal. A calibração da fase 03 mede os gramas por
volta, então qualquer geometria funciona.

---

## Pinagem

Detalhe completo e justificativa de cada escolha em [`docs/pinagem.md`](docs/pinagem.md).

**Mapa interativo da protoboard:** [`hardware/montagem-protoboard.html`](hardware/montagem-protoboard.html)
— abra no navegador. Filtra a fiação por etapa de montagem (energia, motor, balança, relógio,
buzzer, botões) e por modo de alimentação (bancada com USB ou montagem final só com a fonte).
Etapas já feitas ficam esmaecidas, a atual em destaque, as futuras ocultas.

| ESP32 | Vai para | Observação |
|---|---|---|
| GPIO 26 | DRV8825 · `STP` | Cada pulso, um micropasso |
| GPIO 27 | DRV8825 · `DIR` | Sentido de giro |
| GPIO 25 | DRV8825 · `EN` | Ativo em nível baixo |
| GPIO 16 | HX711 · DT | Dados da balança |
| GPIO 4 | HX711 · SCK | Clock da balança |
| GPIO 21 | DS3231 · SDA | I²C |
| GPIO 22 | DS3231 · SCL | I²C |
| GPIO 17 | Base do BC337 | Sempre com resistor de 1 kΩ |
| GPIO 33 | Botão frente | Alimentar / config WiFi. Pull-up interno |
| GPIO 32 | Botão traseiro | Tara da balança. Pull-up interno |
| GPIO 2 | LED da placa | Status |
| VIN | Saída do LM2596 | Confira 5,0 V antes de conectar |
| 3V3 | HX711 e DS3231 | **Nunca 5 V** |
| GND | Todos os módulos | Terra comum obrigatório |

---

## Erros que queimam peça

1. **Ajustar o LM2596 depois de ligar.** Ele sai de fábrica em tensão arbitrária, às vezes
   12 V direto. Ligue a fonte, meça a saída, ajuste para 5,0 V e só então conecte o ESP32.
2. **Alimentar o HX711 com 5 V.** A saída de dados acompanha a alimentação e você entrega
   5 V a um pino que tolera 3,3 V.
3. **Mexer no motor com a placa energizada.** Conectar ou desconectar as bobinas do NEMA
   com o DRV8825 ligado destrói o driver na hora.
3. **Trocar os pares de bobina.** `1A` faz par com `1B`, `2A` com `2B`. Ligar `1A` com `2A`
   faz o motor só vibrar. Ache os pares medindo resistência: mesmo par dá 2 a 3 Ω.
4. **Capacitor invertido.** A faixa clara marca o negativo, que vai no GND. Invertido, estufa.

### Ajuste de corrente do DRV8825

```
Corrente por bobina = VREF × 2      (placas com resistor de 0,1 Ω)

Alvo: 1,0 A  →  VREF = 0,50 V
```

Com o **motor desconectado** e a fonte ligada, ponta preta no GND e vermelha no parafuso do
potenciômetro. Gire até ler 0,50 V. Se a ração compactar e travar, suba para 0,60 V.

---

## Fases

Cada fase termina num teste que passa ou não passa. Nenhuma começa antes da anterior fechar.

| # | Fase | Fecha quando |
|---|---|---|
| 00 | Bancada | O LED da placa pisca com código seu |
| 01 | Energia | Multímetro lê 5,0 V no LM2596 e 3,3 V na placa |
| 02 | Motor gira | O eixo dá exatamente uma volta e para, sem esquentar |
| 03 | Balança e calibração | Leitura bate com peso conhecido dentro de ±2 g |
| 04 | Dosagem em malha fechada | Pedir 80 g entrega 80 g; rosca travada detectada em 5 s |
| 05 | Autonomia | Com o cabo de rede arrancado, alimenta no horário certo |
| 06 | Broker e conexão | Alimentar pelo celular, no 4G, fora de casa |
| 07 | Aplicativo | Alguém usa sem explicação |
| 08 | Campo | Funciona sozinho por sete dias |

Detalhe de cada fase em [`docs/fases.md`](docs/fases.md).

---

## Tópicos MQTT

| Tópico | Quem escreve | Conteúdo |
|---|---|---|
| `feeder/<id>/status` | alimentador | online/offline, peso, sinal. *Retido* |
| `feeder/<id>/schedule` | app | Horários e porções. *Retido* |
| `feeder/<id>/cmd/feed` | app | Alimentar agora, em gramas |
| `feeder/<id>/cmd/skip` | app | Pular a próxima refeição |
| `feeder/<id>/event/fed` | alimentador | Pedido, entregue, gatilho |
| `feeder/<id>/event/alert` | alimentador | Rosca travada, ração acabando, prato intocado |

O alimentador registra um *last will*: se ele cair, o broker publica sozinho o aviso de que
sumiu. A descoberta é em segundos, sem ninguém precisar perguntar.

---

## Estrutura

```
docs/        documentação: pinagem, fases, arquitetura, calibração
firmware/    PlatformIO + Arduino framework (ESP32)
app/         React Native / Expo
infra/       Mosquitto: compose, config, ACL
hardware/    diagramas, fotos da montagem, peças 3D
```

## Licença

MIT — veja [LICENSE](LICENSE).
