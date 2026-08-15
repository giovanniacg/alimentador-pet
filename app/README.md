# App do alimentador

React Native + Expo (SDK 57), TypeScript strict. O app fala **direto com o
broker MQTT** por WebSocket seguro na porta 443. Não existe backend próprio.

Contrato dos tópicos e payloads: [`docs/mqtt.md`](../docs/mqtt.md) na raiz do
repositório. Aquele documento manda; este app apenas o obedece.

## Quem usa

Os pais do Giovanni. Público 50+, não técnico. Consequências práticas no código:

- Fonte grande (mínimo 16, corpo 20, números 30+), alto contraste, um tema claro só.
- Alvo de toque nunca abaixo de 56 dp (WCAG 2.2 SC 2.5.8 pede 24, aqui vai bem acima).
- Nenhuma ação por arrastar: ajuste é sempre por botão `−` / `+` (SC 2.5.7).
- Informação nunca só por cor: todo estado tem símbolo e texto (SC 1.4.1).
- Nada de jargão: não aparece "MQTT", "broker", "tópico" ou "QoS" em tela.
- Toda ação que mexe no aparelho pede confirmação antes de enviar.

## Telas

| Rota | Arquivo | O que faz |
|---|---|---|
| `/login` | `src/app/login.tsx` | Endereço do servidor, usuário e senha. Guarda no `expo-secure-store` e entra sozinho nas próximas aberturas. |
| `/` | `src/app/(tabs)/index.tsx` | Estado do aparelho, última e próxima refeição, botão gigante Alimentar agora, pular próxima refeição, sair. |
| `/agenda` | `src/app/(tabs)/agenda.tsx` | Até 8 refeições (hora + gramas). Salvar publica a agenda inteira. |
| `/historico` | `src/app/(tabs)/historico.tsx` | Eventos recebidos durante a sessão. Sem persistência, por decisão de escopo. |

## Arquitetura

```
src/
  app/                  rotas (expo-router)
  components/           botão grande, cartão, stepper, painel de estado
  feeder/
    provider.tsx        conexão MQTT, reconexão com backoff, estado e comandos
    parse.ts            payloads chegam como unknown e passam por type guards
    format.ts           frases em português (funções puras)
    topics.ts           tópicos do contrato e montagem da URL wss
    types.ts            Meal, FeederState, FeederEvent, ConnectionStatus
    credentials.ts      expo-secure-store
  config.ts             constantes: host padrão, keepalive, limites
  theme.ts              cores (contraste conferido), tamanhos, alvo de toque
```

Regras que valem a pena não quebrar:

- Só o `FeederProvider` toca no cliente MQTT. As telas usam `useFeeder()`.
- Todo payload que vem do broker é `unknown` até passar por `parse.ts`. O LWT
  publica só `{"online":false}`, então o estado precisa aguentar campos ausentes.
- `keepalive` de 45 s: a Cloudflare derruba WebSocket ocioso perto de 100 s.
- Reconexão com backoff exponencial de 1 s até 30 s.
- Senha recusada pelo broker não entra em loop de retentativa: apaga as
  credenciais e volta para o login com a explicação na tela.

## Rodar

```bash
cd app
npm install
npx expo start          # abra o QR Code no Expo Go
npx tsc --noEmit        # checagem de tipos
npx expo lint
```

Antes de conectar, preencha `DEFAULT_BROKER_HOST` em `src/config.ts` (ou digite
o endereço na tela de login). O domínio real não fica no repositório, mesma
regra do firmware.

Se a conexão falhar com 404, o caminho do WebSocket é o suspeito: veja
`BROKER_WS_PATH` em `src/config.ts` (`/mqtt` por padrão).

## APK

```bash
npx eas build --platform android --profile preview
```

O perfil `preview` já sai como `.apk` para instalar direto no celular.
