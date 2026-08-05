# Pinagem

Ligações completas entre o ESP32-WROOM-32 e os módulos, com a justificativa de cada escolha.

## Tabela

| ESP32 | Módulo | Pino | Tipo | Observação |
|---|---|---|---|---|
| GPIO 26 | DRV8825 | STEP | saída | Cada pulso avança um micropasso |
| GPIO 27 | DRV8825 | DIR | saída | Sentido de giro; inverter no firmware se sair ao contrário |
| GPIO 25 | DRV8825 | ENABLE | saída | Ativo em nível BAIXO. Manter ALTO em repouso |
| GPIO 16 | HX711 | DT / DOUT | entrada | Dados da balança |
| GPIO 4 | HX711 | SCK | saída | Clock da balança |
| GPIO 21 | DS3231 + OLED | SDA | I²C | Barramento compartilhado |
| GPIO 22 | DS3231 + OLED | SCL | I²C | Barramento compartilhado |
| GPIO 17 | BC337 | base | saída | **Sempre** com resistor de 1 kΩ em série |
| GPIO 33 | Botão frente | — | entrada | Alimentar / config WiFi. `INPUT_PULLUP` |
| GPIO 32 | Botão traseiro | — | entrada | Tara da balança. `INPUT_PULLUP` |
| GPIO 2 | LED onboard | — | saída | Já existe na placa |
| VIN | LM2596 | saída | 5 V | Medir 5,0 V **antes** de conectar |
| 3V3 | HX711, DS3231 | VCC | 3,3 V | Nunca 5 V nesses módulos |
| GND | todos | GND | terra | Terra comum obrigatório |

## Por que esses pinos

O ESP32 tem 34 GPIOs e boa parte é armadilha:

- **GPIO 6 a 11** — ligados à memória flash interna. Usá-los trava a placa no boot.
- **GPIO 34 a 39** — só entrada, sem resistor de pull-up interno.
- **GPIO 0, 2, 12, 15** — lidos no boot para decidir como a placa inicia. O GPIO 12 em
  especial, se estiver em nível alto na energização, configura a flash para a tensão errada
  e a placa não sobe.
- **ADC2** (GPIO 0, 2, 4, 12-15, 25-27) — não funciona com o WiFi ligado. Aqui não é
  problema porque nenhum desses é usado como entrada analógica.

Os pinos escolhidos ficam fora dessas faixas e estão agrupados fisicamente, o que mantém o
chicote organizado.

## Jumpers do DRV8825

- **RESET e SLEEP** ligados um no outro e ambos em 3,3 V. Sem isso o driver nunca sai do
  repouso — é a causa número um de "o motor não gira e não aparece erro nenhum".
- **Micropasso 1/8:** MS0 e MS1 em nível ALTO, MS2 livre.

| MS0 | MS1 | MS2 | Resolução |
|---|---|---|---|
| baixo | baixo | baixo | passo inteiro |
| alto | baixo | baixo | 1/2 |
| baixo | alto | baixo | 1/4 |
| alto | alto | baixo | **1/8 (usado)** |
| baixo | baixo | alto | 1/16 |
| alto | alto | alto | 1/32 |

Com 1/8 de micropasso, uma volta completa do NEMA 17 são **1600 pulsos** (200 passos × 8).

## Ajuste de corrente (VREF)

```
Corrente por bobina = VREF × 2      (placas com resistor de sense de 0,1 Ω)

Alvo: 1,0 A  →  VREF = 0,50 V
```

Procedimento:

1. Desconecte o motor do driver.
2. Ligue a fonte de 12 V.
3. Ponta preta do multímetro no GND, ponta vermelha no parafuso do potenciômetro.
4. Gire devagar até ler 0,50 V.
5. Desligue a fonte e só então conecte o motor.

Um ampere é folgado para uma rosca sem-fim e mantém o driver frio. Se a ração compactar e
travar, suba para 0,60 V.

> Algumas placas clone usam resistor de sense de 0,05 Ω, e nelas a conta é
> `corrente = VREF × 4`. Confira o valor impresso nos resistores ao lado do chip antes de
> confiar no número.

## Buzzer

```
        +12 V
          │
      ┌───┴───┐
      │buzzer │
      └───┬───┘
          ├──────►│──────┐   1N4007 (faixa/catodo para o +12 V)
          │              │
          C              │
GPIO17 ──[1kΩ]── B       │   BC337 (NPN)
          E              │
          │              │
         GND ────────────┘   terra comum com o ESP32
```

**Pinagem do BC337:** com a face plana virada para você e os pinos para baixo, da esquerda
para a direita é **Emissor, Base, Coletor**. Atenção: o BC547, de corpo idêntico, é o
inverso (C-B-E). Trocar não queima na hora, mas não chaveia — e você perde a tarde
depurando um firmware que está correto.

## Ordem de montagem segura

1. Trilho de 12 V a partir do conector P4.
2. Ajustar o LM2596 para 5,0 V **com nada conectado na saída**.
3. Terra comum, conferido com o multímetro em continuidade.
4. ESP32 no VIN.
5. Driver com capacitor e jumpers, VREF ajustado, motor ainda desconectado.
6. Desligar a fonte, conectar o motor.
7. HX711 e DS3231 em 3,3 V.
8. Buzzer e botão.

## Botões

Dois botões inox 12 mm IP66, momentâneos (normalmente abertos). Cada um tem dois
terminais: um vai ao GPIO, o outro ao GND. O firmware usa `INPUT_PULLUP`, então o pino
fica em nível alto em repouso e vai a zero quando apertado.

| Botão | Posição | Gesto | Função |
|---|---|---|---|
| Frente (GPIO 33) | acessível | toque | Alimentar agora, porção padrão |
| | | segurar 5 s | Abrir portal de configuração de WiFi |
| Traseiro (GPIO 32) | discreto | toque | Zerar a balança (tara) com o prato vazio |
| | | segurar 5 s | reservado |

**Por que a tara merece botão próprio.** Quem lava o prato e recoloca introduz um
deslocamento constante na leitura: água parada, prato ligeiramente fora de posição, ou um
prato diferente. A partir daí toda dose sai errada de forma silenciosa — pede-se 80 g e
saem 60 g, todo dia, sem sintoma óbvio. Com o botão, o conserto é local e não depende de
app nem de ninguém: prato vazio no lugar, um toque, pronto.

O botão de tara fica fisicamente afastado do de alimentar de propósito. Lado a lado,
alguém aperta por engano com ração no prato e a calibração vai junto.

**Debounce:** contato mecânico oscila por alguns milissegundos ao fechar. Ignore mudanças
por 50 ms depois da primeira transição, senão um toque vira várias doses.

**Corpo metálico:** o invólucro do botão é inox. Em caixa plástica não há problema. Se a
caixa for metálica, garanta que o corpo não encoste em nada energizado.

- IP66: protegido contra poeira e jato d'água, adequado à área do comedouro.
- Temperatura de operação: -22 a +55 °C.

## Display OLED

Módulo SSD1306 de 0,96 polegada, 128 × 64, com interface I²C.

**Não exige nenhuma peça adicional.** O I²C é um barramento: o display entra em paralelo
com o DS3231 nos mesmos GPIO 21 e 22. Cada dispositivo tem endereço próprio e eles não
colidem.

| Display | Vai para |
|---|---|
| GND | GND comum |
| VDD | 3V3, mesmo trilho do DS3231 |
| SCK | GPIO 22, junto com o SCL do RTC |
| SDA | GPIO 21, junto com o SDA do RTC |

| Dispositivo | Endereço |
|---|---|
| SSD1306 | `0x3C` (algumas placas vêm em `0x3D`) |
| DS3231 | `0x68` |

Se o display não aparecer, rode um scanner de I²C antes de suspeitar de qualquer outra
coisa: ele lista os endereços presentes no barramento e resolve a dúvida em segundos.

### Pull-ups

Cada módulo traz os seus, de 4,7 kΩ. Dois em paralelo resultam em 2,35 kΩ, dentro da faixa
saudável. Só passaria a incomodar com quatro ou cinco módulos no mesmo barramento — aí
seria preciso remover os resistores de alguns deles.

### Burn-in — regra de projeto

OLED é tecnologia orgânica e **degrada onde fica aceso**. Conteúdo estático 24 horas por
dia deixa fantasma permanente em questão de meses.

Portanto o display não é um painel sempre ligado, e sim algo que **acorda**:

- apagado por padrão;
- acende ao toque de qualquer botão, ou durante uma dose;
- dorme sozinho após 30 s (`OLED_SLEEP_MS`).

Efeito colateral bom: "ver o estado" vira um gesto explícito, o que é mais claro para quem
opera o aparelho do que um painel que está sempre lá.

### Versão bicolor

O modelo amarelo-e-azul tem as 16 primeiras linhas de pixels fisicamente amarelas e as 48
restantes azuis. Isso é o material do painel, não configuração de software: qualquer
elemento que cruze a linha 16 sai partido em duas cores.

Para liberdade de layout, prefira a versão monocromática. Se usar a bicolor, projete a
interface tratando a linha 16 como divisor fixo — cabeçalho em cima, dados embaixo.

### O que mostrar

- Peso atual no prato
- Próxima refeição e porção
- Estado da conexão
- Durante a dose: progresso em gramas
- Em falha: a causa em texto legível, não um código de erro
