# Pinagem

Ligações completas entre o ESP32-WROOM-32 e os módulos, com a justificativa de cada escolha.

## Tabela

| ESP32 | Módulo | Pino | Tipo | Observação |
|---|---|---|---|---|
| GPIO 26 | DRV8825 | `STP` | saída | Cada pulso avança um micropasso |
| GPIO 27 | DRV8825 | `DIR` | saída | Sentido de giro; inverter no firmware se sair ao contrário |
| GPIO 25 | DRV8825 | `EN` | saída | Ativo em nível BAIXO. Manter ALTO em repouso |
| GPIO 16 | HX711 | DT / DOUT | entrada | Dados da balança |
| GPIO 4 | HX711 | SCK | saída | Clock da balança |
| GPIO 21 | DS3231 | SDA | I²C | Barramento, aceita mais módulos |
| GPIO 22 | DS3231 | SCL | I²C | Barramento, aceita mais módulos |
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

## DRV8825: os 16 pinos

A serigrafia usa abreviações. Equivalências:

| Serigrafia | É o | Destino |
|---|---|---|
| `STP` | STEP | GPIO 26 |
| `DIR` | DIR | GPIO 27 |
| `EN` | ENABLE (ativo em baixo) | GPIO 25 |
| `SLP` | SLEEP | jumper com `RST`, e o par no 3,3 V |
| `RST` | RESET | jumper com `SLP`, e o par no 3,3 V |
| `M0` `M1` `M2` | seleção de micropasso | `M0` e `M1` no 3,3 V, `M2` solto |
| `UMOT` | VMOT (notação europeia, U = tensão) | trilho 12 V |
| `1A` `1B` | bobina 1 do motor | par entre si |
| `2A` `2B` | bobina 2 do motor | par entre si |
| `FLT` | FAULT (saída de falha, dreno aberto) | deixar solto |
| `GND` ×2 | terra lógico e terra de potência | ambos no terra comum |

> **Não existe pino VDD.** O DRV8825 gera a própria alimentação lógica internamente a
> partir do UMOT. Quem tem VDD é o A4988, que é fisicamente parecido — confundir os dois é
> comum. O que precisa ir ao 3,3 V são `SLP` e `RST`.

### Orientação da placa

Placas iguais aparecem em orientações opostas nos tutoriais. Lendo a serigrafia com `DIR`
no topo do lado esquerdo, a ordem é:

```
esquerda (topo → base):  DIR  STP  SLP  RST  M2  M1  M0  EN
direita  (topo → base):  GND  FLT  2A   1A   1B  2B  GND  UMOT
```

Virando 180°, essa mesma placa dá a ordem dos diagramas mais comuns. **A serigrafia é a
fonte da verdade, não a posição na bancada.** Confira o nome impresso ao lado de cada pino
antes de espetar o jumper.

### Jumpers obrigatórios

- **`SLP` e `RST`** ligados um no outro e o par em 3,3 V. Sem isso o driver nunca sai do
  repouso — é a causa número um de "o motor não gira e não aparece erro nenhum".
- **Micropasso 1/8:** `M0` e `M1` em nível ALTO, `M2` solto. Os pinos de modo têm pull-down
  interno, então deixar solto já vale como nível baixo.

| M0 | M1 | M2 | Resolução |
|---|---|---|---|
| baixo | baixo | baixo | passo inteiro |
| alto | baixo | baixo | 1/2 |
| baixo | alto | baixo | 1/4 |
| alto | alto | baixo | **1/8 (usado)** |
| baixo | baixo | alto | 1/16 |
| alto | alto | alto | 1/32 |

### Bobinas: quem é par de quem

**`1A` faz par com `1B`; `2A` faz par com `2B`.** Não é `1A` com `2A`. Na placa os pinos
ainda aparecem intercalados (`2A 1A 1B 2B`), então o par externo é o 2 e o interno é o 1.
Ligar como se `1A` e `2A` fossem par faz o motor apenas vibrar e travar.

Para achar os pares nos quatro fios do NEMA 17: multímetro em resistência, motor
desconectado, testando os fios dois a dois. **Fios do mesmo par acusam 2 a 3 Ω; de pares
diferentes, nada.** Qual par você chama de 1 e qual de 2 é indiferente — no máximo o motor
gira ao contrário, e aí basta inverter o `DIR` no firmware.

#### Motor deste projeto (medido em 05/08/2026)

| Fio do motor | Vai em |
|---|---|
| verde | `1A` |
| preto | `1B` |
| azul | `2A` |
| vermelho | `2B` |

Pares confirmados no multímetro: verde com preto, azul com vermelho. Bate com o padrão de
fábrica do NEMA 17. Dentro de um par a ordem é indiferente — inverter só troca o sentido de
rotação, corrigível no `DIR`. Atravessar os pares trava o motor vibrando.

> Esses quatro fios saem do próprio motor e não passam por jumper. As cores são de fábrica,
> não escolha de montagem. O verde usado para o motor no mapa da protoboard é código de
> subsistema, não instrução de qual jumper pegar.

Com 1/8 de micropasso, uma volta completa do NEMA 17 são **1600 pulsos** (200 passos × 8).

## Ajuste de corrente (VREF)

```
Corrente por bobina = VREF × 2      (placas com resistor de sense de 0,1 Ω)

Alvo: 1,4 A  →  VREF = 0,70 V
```

O motor deste projeto é um NEMA 17 de 4,2 kg·cm, equivalente ao **17HE15-1504S**:
**1,5 A por fase** de corrente nominal e **2,3 Ω** de resistência de fase. A medição de
2 a 3 Ω entre os fios de cada par confere com esse número e confirma bobinas íntegras.

O alvo de 0,70 V (1,4 A) fica logo abaixo do nominal, com folga térmica. Se faltar força
com a rosca montada, dá para ir a 0,75 V.

> **Correção de 10/08/2026.** Este documento recomendava 0,50 V (1,0 A), escolhido por
> prudência térmica sem consultar o nominal do motor. É apertado demais para vencer o
> atrito de uma rosca: o sintoma é o motor vibrar ou dar trancos fracos sem girar, que é
> exatamente o que a bancada apresentou.

Procedimento:

1. Desconecte o motor do driver.
2. Ligue a fonte de 12 V.
3. Ponta preta do multímetro no GND, ponta vermelha no parafuso do potenciômetro.
4. Gire devagar até ler 0,50 V.
5. Desligue a fonte e só então conecte o motor.

Se a ração compactar e travar mesmo em 0,70 V, suba de 0,05 em 0,05 V até 0,75 V, que é o
nominal do motor. Acima disso o motor esquenta sem ganho real de torque útil.

**Corrente baixa demais é a causa número um de "vibra mas não gira".** O fórum da Pololu
registra o mesmo sintoma: abaixo de certo limiar de VREF, o motor treme sem rotacionar.

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

## Display OLED — ADIADO

> **Estudado em 05/08/2026 e adiado.** Não há função definida para a tela ainda, e o
> comportamento dela precisa ser decidido antes da compra por causa do burn-in descrito
> abaixo. As notas ficam aqui prontas para quando o assunto voltar.

Módulo SSD1306 de 0,96 polegada, 128 × 64, com interface I²C.

**Não exigiria nenhuma peça adicional.** O I²C é um barramento: o display entra em paralelo
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
