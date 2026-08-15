# Contrato MQTT: firmware <-> app

Broker Mosquitto com WebSocket + TLS na porta 443 (atras do Traefik).
O dominio real, usuarios e senhas NAO ficam neste repo: o app pede no login
e o firmware le de `include/secrets.h` (gitignored).

Regra inegociavel do projeto: **o agendamento roda LOCAL no ESP32** (NVS +
DS3231). O broker e canal de comando e telemetria. Sem internet, o bicho
come do mesmo jeito.

Prefixo de topico por aparelho: `feeder/<id>` (primeiro aparelho: `feeder/sp01`).

## Comandos (app -> firmware), QoS 1

| Topico | Payload JSON | Efeito |
|---|---|---|
| `feeder/sp01/cmd/feed` | `{"grams": 40}` | alimenta agora |
| `feeder/sp01/cmd/skip` | `{}` | pula a PROXIMA refeicao agendada |
| `feeder/sp01/cmd/schedule` | `{"meals":[{"h":7,"m":0,"grams":40},{"h":19,"m":0,"grams":40}]}` | substitui a agenda inteira (max 8 refeicoes) |
| `feeder/sp01/cmd/tare` | `{}` | tara a balanca |

## Estado (firmware -> app)

| Topico | Retained | Payload |
|---|---|---|
| `feeder/sp01/state` | sim | `{"online":true,"rtc":"2026-08-15T19:00:00","hopper_g":812,"last_meal":{"ts":"...","grams":40,"ok":true},"next_meal":{"h":19,"m":0,"grams":40},"skip_next":false}` |
| `feeder/sp01/schedule` | sim | espelho da agenda vigente, mesmo formato do cmd |
| `feeder/sp01/event` | nao | um JSON por evento: `{"type":"meal_done","grams":39}`, `{"type":"meal_failed","reason":"sem_racao"}`, `{"type":"button_feed"}` |

- `state` e republicado a cada 60 s e apos qualquer evento.
- LWT: broker publica `{"online":false}` retained em `feeder/sp01/state`
  quando o firmware cai (keepalive 45 s, abaixo dos ~100 s do timeout de WS).

## Autenticacao

Usuarios no broker (ACL deny-by-default, ja escrita em `infra/mosquitto/acl`):
- `feeder-sp01`: publica em `feeder/sp01/#`, assina `feeder/sp01/cmd/#`
- `app-giovanni`: assina `feeder/sp01/#`, publica em `feeder/sp01/cmd/#`
