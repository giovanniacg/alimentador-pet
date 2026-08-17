# Contrato MQTT: firmware <-> app

Broker Mosquitto com WebSocket + TLS na porta 443 (atras do Traefik).
O dominio real, usuarios e senhas NAO ficam neste repo: o app pede no login
e o firmware le de `include/secrets.h` (gitignored).

Regra inegociavel do projeto: **o agendamento roda LOCAL no ESP32** (NVS +
DS3231). O broker e canal de comando e telemetria. Sem internet, o bicho
come do mesmo jeito.

Prefixo de topico por aparelho: `feeder/<id>` (primeiro aparelho: `feeder/sp01`).

## Modos de dosagem

A v1 opera SEM celula de carga: dosagem por TEMPO de rosca girando. A balanca
e opcional e configuravel remotamente (ninguem estara fisicamente la):

- `timer` ........ gira a rosca por N segundos. Default da v1.
- `scale_bowl` ... balanca sob o PRATO: dosa ate o peso SUBIR o alvo em gramas.
- `scale_hopper` . balanca sob o RESERVATORIO: dosa ate o peso DESCER o alvo.

Cada refeicao/comando traz `secs` (modo timer) ou `grams` (modos scale).
Se vier o campo errado pro modo ativo, o firmware converte pelo fator
`g_per_s` da config (estimativa), e reporta no evento o que usou.

## Comandos (app -> firmware), QoS 1

| Topico | Payload JSON | Efeito |
|---|---|---|
| `feeder/sp01/cmd/feed` | `{"secs": 8}` ou `{"grams": 40}` | alimenta agora |
| `feeder/sp01/cmd/skip` | `{}` | pula a PROXIMA refeicao agendada |
| `feeder/sp01/cmd/schedule` | `{"meals":[{"h":7,"m":0,"secs":8},{"h":19,"m":0,"secs":8}]}` | substitui a agenda inteira (max 8 refeicoes; cada meal com `secs` ou `grams`) |
| `feeder/sp01/cmd/config` | objeto parcial, ver abaixo | altera config; campos omitidos ficam como estao |
| `feeder/sp01/cmd/tare` | `{}` | tara a balanca (so modos scale) |
| `feeder/sp01/cmd/calibrate` | `{"known_g": 500}` | calibra a balanca com peso conhecido ja posicionado |

### Config (persistida em NVS, espelhada retained em `feeder/sp01/config`)

```json
{
  "mode": "timer",            // timer | scale_bowl | scale_hopper
  "rpm": 20,                  // velocidade de cruzeiro da rosca (5..60)
  "default_secs": 8,          // dose rapida do botao fisico / feed sem payload (modo timer)
  "default_grams": 40,        // idem para modos scale
  "max_secs": 60,             // teto de seguranca de rosca girando por dose
  "siren": true,              // sirene antes da refeicao (avisa o cachorro)
  "siren_secs": 2,            // duracao do aviso
  "g_per_s": 5.0              // estimativa gramas/segundo (conversao entre modos)
}
```

Faixas validadas pelo firmware (fora disso o campo e rejeitado e reportado no
evento `config_changed`): `rpm` 5..60, `default_secs` 1..max_secs,
`default_grams` 5..200, `max_secs` 5..120, `siren_secs` 1..10,
`g_per_s` 0.5..20.

Desempate: se um meal ou um `cmd/feed` trouxer `secs` E `grams` ao mesmo
tempo, vale o campo do MODO ATIVO; o outro e ignorado.

## Estado (firmware -> app)

| Topico | Retained | Payload |
|---|---|---|
| `feeder/sp01/state` | sim | `{"online":true,"fw":"v2","rtc":"2026-08-15T19:00:00","mode":"timer","scale_g":null,"last_meal":{"ts":"...","secs":8,"ok":true},"next_meal":{"h":19,"m":0,"secs":8},"skip_next":false}` (`scale_g` so nos modos scale, senao null) |
| `feeder/sp01/schedule` | sim | espelho da agenda vigente, mesmo formato do cmd |
| `feeder/sp01/config` | sim | espelho da config vigente, formato acima |
| `feeder/sp01/event` | nao | um JSON por evento: `{"type":"meal_done","secs":8}`, `{"type":"meal_failed","reason":"sem_racao"}` (so detectavel nos modos scale), `{"type":"button_feed"}`, `{"type":"config_changed"}` |

- `state` e republicado a cada 60 s e apos qualquer evento.
- LWT: broker publica `{"online":false}` retained em `feeder/sp01/state`
  quando o firmware cai (keepalive 45 s, abaixo dos ~100 s do timeout de WS).

## Autenticacao

Usuarios no broker (ACL deny-by-default, ja escrita em `infra/mosquitto/acl`):
- `feeder-sp01`: publica em `feeder/sp01/#`, assina `feeder/sp01/cmd/#`
- `app-giovanni`: assina `feeder/sp01/#`, publica em `feeder/sp01/cmd/#`
