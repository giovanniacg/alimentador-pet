# Infraestrutura

Broker MQTT (Mosquitto) atras do Traefik, exposto como `$MQTT_HOST` sobre
WebSocket seguro na porta 443.

## Por que WebSocket e nao MQTT nativo

O alimentador fica na casa dos pais, sem VPN e sem ninguem para configurar rede. O broker
precisa ser alcancavel pela internet aberta.

WebSocket seguro na 443 resolve isso sem custo:

- nenhuma porta nova exposta - entra pela 443 que o Traefik ja atende
- certificado curinga do dominio ja existe, com renovacao automatica
- o IP real da VPS continua escondido atras da Cloudflare
- do lado da instalacao nao ha nada a configurar

## Subir

```bash
# 1. criar as credenciais (fora do git)
docker run --rm -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /mosquitto/config/passwd feeder-sp01 SENHA_DO_FEEDER

docker run --rm -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/passwd app-giovanni SENHA_DO_APP

# 2. subir
docker compose --env-file .env -f mosquitto/compose.yml up -d
```

As duas senhas vao para o cofre (Vaultwarden), nunca para o repositorio. O arquivo
`config/passwd` esta no `.gitignore`.

## Testar

```bash
mosquitto_sub -h $MQTT_HOST -p 443 --ws -u app-giovanni -P SENHA \
  -t 'feeder/#' -v
```

## Keepalive de 45 s

A Cloudflare encerra WebSocket ocioso perto de 100 s. Os dois clientes (firmware e app)
precisam de keepalive em 45 s. Sem isso a conexao cai de forma intermitente e parece bug
de firmware.

## Consumo

Mosquitto em repouso fica em torno de 15 MB de RAM e praticamente zero CPU.
