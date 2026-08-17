# Especificação de UI: app Alimentador (alimentador-pet)

**Escopo:** `/Users/administrador/Documents/alimentador-pet/app/src/**`
**Data:** 2026-08-17
**Autor:** Dani (design de produto / UI)
**Status:** pronto para implementação
**Público:** casal 50+ não técnico (celular da mãe com fonte e zoom do sistema aumentados) + admin remoto (dev)

Prioridades: `[P0]` quebra uso real, `[P1]` melhora clara, `[P2]` polimento.

---

## 0. Diagnóstico em uma linha

O app não tem problema de acessibilidade, tem problema de **calibragem**. Tudo foi dimensionado assumindo "grande = acessível", sem contar que o sistema da mãe já multiplica por ~1.3. O resultado é um app que já nasce em zoom e depois é multiplicado de novo. Três defeitos são estruturais: (a) não existe token de **altura de controle** separado de token de fonte, (b) o `flexGrow: 1` nos chips faz o órfão virar barra, (c) o login não sobe com o teclado.

Regra que atravessa a spec inteira:

> **Fonte escala com o sistema. Caixa não escala: cresce.**
> Altura de controle é `minHeight` em dp fixo. Nunca `height`. Nunca proporcional à fonte.

---

## 1. Escala, densidade e convivência com font scaling do sistema

### 1.1 [P0] Não existe token de tamanho de controle: alturas são derivadas de `MIN_TOUCH` com aritmética solta

**Arquivo:** `src/theme.ts`; usos em `big-button.tsx:127` (`MIN_TOUCH + 12`), `stepper.tsx:135-136` (`MIN_TOUCH + 8`), `big-button.tsx:137` (`minHeight: 120`), `(tabs)/_layout.tsx:21` (`height: 86`).

O `MIN_TOUCH = 56` virou base de aritmética ad hoc. Daí saem controles de 56, 64, 68, 86 e 120 dp sem nenhuma regra, e o de 120 é o "botão gigante" que o Giovanni viu.

**Correção.** Adicionar em `src/theme.ts` (sem remover `MIN_TOUCH`, que vira alias de `control.lg` para não quebrar consumidores; marcar `MIN_TOUCH` como `@deprecated` no JSDoc em vez de deletar):

```ts
/**
 * Alturas de controle, em dp FIXO. Nunca multiplicar por fontScale:
 * o texto dentro cresce e o controle cresce junto via minHeight.
 */
export const control = {
  sm: 44,  // chip de dia, controle em fileira
  md: 48,  // alvo confortavel padrao (Material)
  lg: 56,  // botao padrao, input, linha tocavel
  xl: 64,  // botao primario de destaque. TETO. Nao existe 120.
} as const;

export const iconSize = { sm: 20, md: 24, lg: 28 } as const;

/** Teto do multiplicador de fonte por papel. Ver secao 1.3. */
export const fontCap = {
  control: 1.3,   // texto DENTRO de botao/chip/aba
  display: 1.2,   // numero grande do stepper, simbolo de status
  title: 1.6,     // titulo de tela
  // conteudo (paragrafo, descricao, erro, item de lista): SEM cap
} as const;
```

Aplicação:

| Componente | Hoje | Passa a ser |
|---|---|---|
| `BigButton` default (`big-button.tsx:127`) | `minHeight: 68` | `minHeight: control.lg` (56) |
| `BigButton` destaque (`big-button.tsx:136-138`, prop `huge`) | `minHeight: 120`, label 40 | prop `huge` **removida**; nova prop `emphasis?: boolean` com `minHeight: control.xl` (64) e label continua `fontSizes.large` (24) |
| `Stepper` botões +/− (`stepper.tsx:135-136`) | `64x64` | `width/height: control.lg` (56) |
| `RowButton` agenda (`agenda.tsx:474`) | `minHeight: 56, minWidth: 88` | `minHeight: control.lg`, `minWidth: 96` (aumenta porque o rótulo cresce com o zoom) |
| `Toggle`, `OptionRow`, input do login | `minHeight: 56` | mantém, agora como `control.lg` |
| Tab bar (`_layout.tsx:21`) | `height: 86` | ver §5.6 |

Fonte: alvo mínimo de 24x24 CSS é o piso normativo, não o alvo ([WCAG 2.2 SC 2.5.8 Target Size (Minimum), W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); alvo frequente maior e perto reduz erro, mas o ganho de Fitts satura muito antes de 120 dp ([Fitts, 1954](https://www.lri.fr/~mbl/ENS/FONDIHM/2013/papers/Fitts-JEP54.pdf)). 56 a 64 dp é a faixa em que o alvo já é trivial de acertar e o layout ainda cabe na tela.

### 1.2 [P1] `fontSizes.huge = 40` usado como rótulo de botão

**Arquivo:** `theme.ts:46`, `big-button.tsx:151-153`, `(tabs)/index.tsx:182` (`huge` no ALIMENTAR AGORA).

40 dp de rótulo com `maxFontSizeMultiplier={1.4}` chega a **56 dp de texto** dentro de uma caixa de 120 dp no celular da mãe. É exatamente o "exageradamente gigante".

**Correção.** `fontSizes.huge` deixa de rotular controle. Fica reservado a **um** uso por tela: o glifo de status (`feeder-status.tsx:116`). Renomear para `fontSizes.display` (alias `huge` mantido com `@deprecated`).

O destaque do botão primário passa a vir de canais redundantes, não de tamanho bruto (hierarquia por combinação de sinais, não por um atributo só; [Material Design 3, Applying Type / Emphasis, acesso 2026-06-20](https://m3.material.io/styles/typography/applying-type)):

- altura 64 dp (os outros ficam em 56),
- fundo sólido verde (os outros são outline),
- largura total,
- ícone `restaurant` 28 dp à esquerda do rótulo,
- `hint` abaixo ("Serve 8 s de ração na hora"),
- 24 dp de respiro acima e abaixo (`spacing.lg`), contra 16 entre os demais.

### 1.3 [P0] Regra de font scaling: hoje é arbitrária (1.3, 1.4, 1.6, ou nada)

**Arquivos:** todos. Ver `screen.tsx:23` (1.6), `big-button.tsx:69` (1.4), `day-chips.tsx:52,57` (1.3), `stepper.tsx:69` (1.4), `login.tsx:143` (1.4), `toggle.tsx:49` (1.4), `option-row.tsx:42` (1.4), `feeder-status.tsx:82` (1.4). E vários textos de conteúdo **sem** cap nenhum, misturados com textos de controle **com** cap. Não há critério: `styles.detail` (feeder-status.tsx:127) não tem cap e `styles.headline` tem, sendo os dois texto de leitura.

**Correção. Regra dura, por papel do texto:**

| Papel | Exemplos | `maxFontSizeMultiplier` | Container |
|---|---|---|---|
| **Conteúdo** | parágrafos, descrições, `styles.detail`, `styles.muted`, mensagens de erro, `hint` de campo, item de histórico | **nenhum** (escala livre até o máximo do sistema) | cresce, `flexShrink: 1`, sem `height` |
| **Rótulo de controle** | texto dentro de `BigButton`, `Toggle`, `OptionRow`, `RowButton`, chip | `fontCap.control` = 1.3 | `minHeight` fixo, `paddingVertical` fixo, rótulo pode quebrar em 2 linhas (`numberOfLines` NÃO setado) |
| **Display numérico** | `stepper.tsx:147` value, `feeder-status.tsx:115` símbolo, `agenda.tsx:454` `rowClock` | `fontCap.display` = 1.2 | idem |
| **Título de tela** | `screen.tsx:45` | `fontCap.title` = 1.6 | livre |
| **Tab bar** | `_layout.tsx:19` | 1.2 | ver §5.6 |

Justificativa e limite: SC 1.4.4 pede ampliação até 200% sem perda de conteúdo ou função ([WCAG 2.2 SC 1.4.4 Resize Text, W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)). Capar em 1.3 **dentro de um controle** é aceitável aqui porque o baseline do app já é elevado (corpo em 20 dp contra os 14 a 16 dp típicos, ou seja, ~140% de partida) e porque todo texto de conteúdo escala sem teto. Capar **texto de conteúdo** não é aceitável e hoje o app faz isso em alguns lugares. `(inferido)` na calibragem do 1.3: a doutrina fixa o requisito de 200%, não o multiplicador de RN.

**Proibido:** `allowFontScaling={false}` em qualquer texto que carregue informação. Se aparecer, só em glifo puramente decorativo, com comentário justificando.

### 1.4 [P1] Densidade adaptativa: em zoom alto, o espaçamento tem que ceder antes do conteúdo

**Arquivos:** `screen.tsx:40-52`, `card.tsx:26-34`, todos os `gap`.

No celular da mãe, gaps de 16 dp entre 8 blocos somam ~128 dp de scroll só de ar, num viewport já reduzido pelo zoom do sistema.

**Correção.** Criar `src/hooks/use-density.ts`:

```ts
import { useWindowDimensions } from 'react-native';

/** Em zoom alto o ar cede primeiro; conteudo e alvo de toque nunca cedem. */
export function useDensity() {
  const { fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.3;
  return {
    compact,
    gap: compact ? 12 : 16,        // spacing.md -> 12
    sectionGap: compact ? 16 : 24, // spacing.lg -> 16
    padding: compact ? 12 : 16,
  } as const;
}
```

Aplicar em `Screen.content` (`screen.tsx:40`), `Screen.body` (`screen.tsx:50`) e `Card.card` (`card.tsx:26`). **Não** aplicar em `control.*` nem em `paddingHorizontal` de campo (o alvo de toque nunca cede). Valores permanecem na grade de 4 e 8 dp ([Material Design 3, Grids & Spacing, acesso 2026-06-20](https://m3.material.io/foundations/layout/understanding-layout/spacing)).

### 1.5 [P1] Falta `lineHeight` em toda a escala

**Arquivo:** `theme.ts:40-47`. Só `stepper.tsx:145` define `lineHeight`. Sem `lineHeight` explícito, o RN usa o default da fonte, e em texto grande (24, 30, 40) a entrelinha vira apertada demais.

**Correção.** Adicionar tipo composto de tipografia em `theme.ts` (compostos agrupam sub-valores da mesma decisão; [DTCG Design Tokens Format Module, 2026-06-17](https://www.designtokens.org/tr/drafts/format/)):

```ts
export const type = {
  label:   { fontSize: 16, lineHeight: 24, fontWeight: '600' },  // 1.50
  body:    { fontSize: 20, lineHeight: 30, fontWeight: '400' },  // 1.50
  bodyBold:{ fontSize: 20, lineHeight: 30, fontWeight: '700' },
  title:   { fontSize: 24, lineHeight: 32, fontWeight: '700' },  // 1.33
  headline:{ fontSize: 30, lineHeight: 38, fontWeight: '700' },  // 1.27
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700' },  // 1.15
} as const;
```

Mapa 1:1 com os valores atuais (`small`->`label`, `body`->`body`, `large`->`title`, `title`->`headline`, `huge`->`display`), portanto **não muda nenhum tamanho**, só adiciona entrelinha e nomeia por papel. Entrelinha entre 1.2 e 1.5, mais folgada no corpo e mais fechada no display ([Material Design 3 Typography, acesso 2026-06-20](https://m3.material.io/styles/typography/applying-type)).

Importante em RN: `lineHeight` numérico **não** escala com `fontScale` do sistema. Onde o texto escala sem cap (conteúdo), **não** setar `lineHeight` fixo, ou a entrelinha aperta e o texto se sobrepõe em zoom alto. Regra: `lineHeight` fixo só nos papéis com cap (`label` de controle, `display`, `title`); em texto de conteúdo, omitir `lineHeight` ou usar `lineHeight: undefined`. `(inferido)` sobre o comportamento de RN, mas o requisito de espaçamento ajustável é normativo ([WCAG 2.1 SC 1.4.12 Text Spacing, via Deque University, acesso 2026-06-20](https://dequeuniversity.com/resources/wcag2.1/1.4.12-text-spacing)).

### 1.6 [DECIDIDO: manter 16/20] Piso de 16 dp e corpo de 20 dp

A escala atual tem piso 16 e corpo 20. Isso é generoso e correto para o público, mas é também o que faz cada tela ter 3 telas de altura. Existia a opção de baixar corpo para 18 e piso para 15, ganhando ~12% de densidade vertical.

**Decisão tomada pelo Giovanni em 2026-08-17: manter 16 / 20**, conforme a recomendação. Mexer na escala tipográfica de um sistema já em uso é decisão cara e afeta diretamente o pai e a mãe, que são o motivo do piso alto. A densidade é resolvida via §1.1 (alturas), §1.2 (fim do 120) e §1.4 (gaps adaptativos), que atacam o problema real sem tocar em legibilidade. Se depois do rollout ainda estiver longo demais, reavaliar a escala, com teste no celular da mãe.

---

## 2. Chips de dia da semana: o sábado órfão

### 2.1 [P0] `flexGrow: 1` + `flexWrap` faz o 7º chip virar uma barra

**Arquivo:** `src/components/day-chips.tsx:77-92`.

```ts
row:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
chip: { minWidth: MIN_CHIP_TOUCH, flexGrow: 1, flexBasis: MIN_CHIP_TOUCH, ... },
```

**Causa exata.** Largura útil dentro do modal em tela de 360 dp: `360 − 16×2 (backdrop) − 16×2 (modalCard) = 296 dp`. Sete chips precisam de `7×44 + 6×4 = 332 dp`. Não cabe. O wrap coloca 6 na primeira linha e **1 na segunda**, e como `flexGrow: 1` manda cada item consumir a folga da sua linha, o sábado sozinho estica para os 296 dp inteiros. É literalmente o que o Giovanni viu, e piora com fonte grande porque o chip cresce.

**Correção (decidida): 7 chips numa linha só, largura igual, sem wrap.**

```ts
row: {
  flexDirection: 'row',
  gap: 4,                    // spacing.xs; NAO 8: 8 nao cabe em tela de 320
  // flexWrap removido de proposito
},
chip: {
  flexBasis: 0,              // ignora o conteudo, divide a linha em 7 iguais
  flexGrow: 1,
  flexShrink: 1,
  minWidth: 0,               // remove MIN_CHIP_TOUCH da largura
  minHeight: control.lg,     // 56 dp: a ALTURA e que garante o alvo
  paddingHorizontal: 0,
  paddingVertical: 8,
  borderWidth: 2,
  borderRadius: radius.md,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
},
```

Largura resultante por chip: `(296 − 24) / 7 = 38.9 dp` em tela de 360; `(256 − 24) / 7 = 33.1 dp` no pior caso realista (iPhone SE, 320 dp). Alvo final **33x56 dp**, bem acima do mínimo de 24x24 e sem sobreposição ([WCAG 2.2 SC 2.5.8, W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). `MIN_CHIP_TOUCH = 44` em `theme.ts:65` deixa de existir como largura mínima; o comentário do token precisa ser reescrito, porque hoje afirma que abaixo de 44 "não caberia", e é justamente o 44 que causa a quebra.

**Por que não 4+3.** Duas linhas resolvem o órfão mas criam um problema pior: quebram a leitura da semana como uma régua contínua (D S T Q Q S S é lido em varredura horizontal, como todo calendário), e a segunda linha de 3 fica com 4 posições de folga que precisam de alinhamento arbitrário. Uma linha só preserva o modelo mental. **Se em teste real de campo o chip de 33 dp se mostrar difícil de acertar** (motricidade fina 50+), o fallback especificado é: `flexWrap: 'wrap'` de volta **com `flexBasis: '22%'`**, forçando 4+3 com larguras iguais nas duas linhas e `justifyContent: 'flex-start'` (nunca `space-between`, que espalharia os 3 de baixo). Nunca voltar ao `flexBasis` em dp com `flexGrow: 1`, que é a combinação que gera o órfão esticado.

### 2.2 [P1] Conteúdo do chip precisa caber em 33 dp de largura

**Arquivo:** `day-chips.tsx:50-59, 93-100`.

Hoje letra em 20/700 e marca em 16/700, empilhadas, com cap 1.3. Em 1.3: `26 + 21 + 16 (padding) + 2 (gap) = 65 dp` de altura contra `minHeight: 44`. O chip estoura o próprio piso e a linha fica desalinhada.

**Correção:**

```ts
letter: { fontSize: 20, lineHeight: 22, fontWeight: '700' },  // maxFontSizeMultiplier={fontCap.control} (1.3)
mark:   { fontSize: 14, lineHeight: 16, fontWeight: '700' },  // maxFontSizeMultiplier={1.15}
```

Altura máxima em 1.3: `26 + 16 + 16 + 2 = 60 dp` contra `minHeight: 56`. Cresce 4 dp de forma controlada, e como a altura é `minHeight` a linha inteira acompanha.

A marca `✓` / `−` **fica**. Estado nunca pode depender só de preenchimento ([WCAG 2.2 SC 1.4.1 Use of Color, W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)). Trocar o `−` do não selecionado por `·` (ponto médio, U+00B7), que é visualmente mais discreto e não sugere "menos / remover".

### 2.3 [P1] Falta o atalho de conjunto de dias

**Arquivo:** `agenda.tsx:397-403` (uso do `DayChips`).

Marcar 5 dias exige 5 toques em alvos de 33 dp, no celular da mãe, dentro de um modal. O app já **exibe** os conjuntos nomeados ("Todos os dias", "Seg a sex", "Sáb e dom" em `format.ts:187-207`) mas não deixa **escolher** por eles. Reconhecimento em vez de recordação e redução de esforço ([NN/G, 10 Usability Heuristics, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)).

**Correção.** Acima da fileira de chips, uma fileira de 3 botões de atalho, altura `control.sm` (44), `flexBasis: 0 / flexGrow: 1`, gap 8, variante outline azul, rótulos: `Todos os dias` | `Seg a sex` | `Sáb e dom`. Ao tocar, substituem a seleção inteira. O atalho correspondente ao conjunto atual fica com fundo `colors.blueSurface` e borda de 3 dp (mesmo padrão de seleção do `OptionRow`), com `accessibilityRole="button"` e `accessibilityState={{ selected: true }}`. Os chips continuam disponíveis para ajuste fino.

---

## 3. Login: teclado cobrindo os campos

### 3.1 [P0] `KeyboardAvoidingView` está por fora do `SafeAreaView` e é no-op no Android

**Arquivo:** `src/app/login.tsx:42-44`.

```tsx
<KeyboardAvoidingView
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <Screen title="Alimentador do pet">
```

Três defeitos somados:

1. **Android sem `behavior`** significa KAV inerte. A tela depende inteiramente do `adjustResize` da janela. Em RN 0.86 o Android é edge-to-edge por padrão, e nesse regime o `adjustResize` não redimensiona a janela como antes: o teclado cobre o conteúdo. É o comportamento que o Giovanni relatou. `(inferido)` na causa-raiz exata do edge-to-edge; o sintoma e a correção não dependem dessa inferência.
2. **KAV envolve o `SafeAreaView`**, então o padding calculado ignora o inset superior e o cálculo sai deslocado no iOS.
3. **`Screen`** (`screen.tsx:16-19`) tem `ScrollView` sem `automaticallyAdjustKeyboardInsets` e com `contentContainerStyle` sem `flexGrow: 1`.

**Correção, opção A (recomendada).** Adicionar `react-native-keyboard-controller` (funciona com edge-to-edge nos dois SOs, expõe a altura real do teclado):

```tsx
// src/app/_layout.tsx: envolver a arvore
import { KeyboardProvider } from 'react-native-keyboard-controller';
<SafeAreaProvider><KeyboardProvider><FeederProvider>...</FeederProvider></KeyboardProvider></SafeAreaProvider>
```

```tsx
// src/components/screen.tsx: nova prop opcional
type ScreenProps = { title: string; children: ReactNode; avoidKeyboard?: boolean };
// quando avoidKeyboard, trocar ScrollView por KeyboardAwareScrollView com:
//   bottomOffset={24}
//   contentContainerStyle={[styles.content, { flexGrow: 1 }]}
//   keyboardShouldPersistTaps="handled"
//   keyboardDismissMode="on-drag"
```

E em `login.tsx`, remover o `KeyboardAvoidingView` inteiro (linhas 42-44 e 100), usando `<Screen title="Alimentador do pet" avoidKeyboard>`.

**Correção, opção B (sem dependência nova).** Manter KAV, mas **dentro** do `SafeAreaView` e ativo nos dois SOs:

```tsx
<SafeAreaView edges={['top','left','right']} style={styles.safe}>
  <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
    <ScrollView
      contentContainerStyle={[styles.content, { flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets   // iOS
    >
```

Opção B depende de `android:windowSoftInputMode` e é frágil sob edge-to-edge. **Preferir A.**

**Critério de aceite (auditável), em Pixel com fonte no máximo e zoom de tela grande:** ao focar o campo **Senha**, o campo e o botão **Entrar** ficam simultaneamente visíveis acima do teclado, sem rolagem manual. Se não couberem os dois, o campo focado fica visível com no mínimo 24 dp de folga abaixo dele e o botão Entrar é alcançável com uma rolagem.

### 3.2 [P1] Sem encadeamento de foco entre os campos

**Arquivo:** `login.tsx:57-83, 116-147`. Só o campo Senha tem `onSubmitEditing`. Nos outros o "Enter" fecha o teclado e o usuário reabre manualmente.

**Correção.** `Field` ganha `inputRef?: RefObject<TextInput>` e `onNext?: () => void`; aplicar `returnKeyType={onNext ? 'next' : 'go'}`, `blurOnSubmit={false}` quando houver `onNext`, e `onSubmitEditing={onNext}`. Encadear Endereço -> Usuário -> Senha -> `handleSubmit`.

### 3.3 [P1] "Mostrar a senha" tem o mesmo peso visual de "Entrar"

**Arquivo:** `login.tsx:85-98`. Dois `BigButton` seguidos, ambos largura total, 56+ dp. Ação auxiliar competindo com a ação primária. Hierarquia precisa de um foco dominante único ([Material Design 3, Applying Type / Emphasis, acesso 2026-06-20](https://m3.material.io/styles/typography/applying-type)).

**Correção.** "Mostrar a senha" vira controle de linha, ancorado ao campo de senha:

- `Pressable` com `minHeight: control.sm` (44), largura de conteúdo (não total), alinhado à direita logo abaixo do input de senha, `marginTop: 4`;
- rótulo em `type.label` (16/600), cor `colors.blue`, sublinhado;
- ícone `visibility` / `visibility-off` 20 dp à esquerda do texto. **Texto permanece** ao lado do ícone, não é substituído por ele;
- `accessibilityRole="switch"`, `accessibilityState={{ checked: showPassword }}`, `accessibilityLabel="Mostrar a senha"`.

Espaço de 24 dp (`spacing.lg`) entre o bloco de campos e o botão Entrar, para separar entrada de ação.

### 3.4 [P1] Erro de formulário aparece no topo, longe do campo

**Arquivo:** `login.tsx:50-55` (caixa de erro acima dos campos) e `login.tsx:21-39` (validação só no submit).

"Preencha o endereço do servidor" nasce no topo, e com o teclado aberto pode estar fora da viewport: o usuário toca Entrar, nada visível acontece. Isso é feedback ausente na prática ([NN/G, 10 Usability Heuristics, Visibility of System Status, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)), e mensagem de erro deve ficar junto do campo que falhou ([NN/G, Error-Message Guidelines, 2023-05-14](https://www.nngroup.com/articles/error-message-guidelines/)).

**Correção:**

1. `Field` ganha prop `error?: string`. Quando presente: borda do input em `colors.red` e 3 dp; abaixo do input, linha com `!` + texto em `colors.red`, `type.label`, `accessibilityRole="alert"`.
2. Estado de erro por campo: `errors: { host?: string; auth?: string }`.
3. `handleSubmit` rola até o primeiro campo com erro (`scrollTo` via ref) e chama `AccessibilityInfo.announceForAccessibility` com a mensagem.
4. A caixa do topo fica **apenas** para `lastError` (erro de conexão vindo do provider), que não pertence a nenhum campo.
5. Validação inline no blur permanece **não implementada** por ora: mostrar erro enquanto o usuário digita transmite repreensão, e o ganho no blur é `(debatido)` na própria fonte ([NN/G, 10 Design Guidelines for Reporting Errors in Forms, 2019-02-03, atualizado 2024-12-12](https://www.nngroup.com/articles/errors-forms-design-guidelines/)). Decisão: erro só no submit, junto do campo.

### 3.5 [P2] Sem estado de carregamento visível no botão Entrar

**Arquivo:** `login.tsx:93-98`. O rótulo vira "Entrando..." e o botão fica cinza, mas não há indicador de movimento; se o handshake MQTT demorar (`CONNECT_TIMEOUT_MS = 15000` em `config.ts:44`), a tela parece travada por 15 segundos.

**Correção.** `BigButton` ganha prop `loading?: boolean`: renderiza `ActivityIndicator` 24 dp à esquerda do rótulo, mantém o botão desabilitado, e o rótulo passa a "Entrando...". Acima de 10 s, o feedback precisa ir além do spinner: aos 8 s, trocar o `disabledReason` para "Está demorando mais que o normal. Confira o endereço do servidor." Três limites de resposta: 0,1 s, 1 s e 10 s ([NN/G, Response Time Limits, Nielsen, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/)).

---

## 4. Componentes compartilhados

### 4.1 [P0] `BigButton`: prop `huge` some, entra `emphasis`

**Arquivo:** `big-button.tsx:19, 68, 136-138, 151-153`; consumidor `(tabs)/index.tsx:183`.

Contrato novo:

| Prop | Tipo | Obrigatória | Default | Nota |
|---|---|---|---|---|
| `label` | `string` | sim | - | sempre texto, nunca só ícone |
| `onPress` | `() => void` | sim | - | |
| `variant` | `'primary' \| 'secondary' \| 'danger'` | não | `'primary'` | |
| `emphasis` | `boolean` | não | `false` | 64 dp em vez de 56; **substitui `huge`** |
| `loading` | `boolean` | não | `false` | novo, §3.5 |
| `hint` | `string` | não | - | `type.label`, sem cap de fonte |
| `disabled` | `boolean` | não | `false` | |
| `disabledReason` | `string` | não | - | exibido em texto **e** em `accessibilityHint` |
| `icon` | `MaterialIcons name` | não | - | `iconSize.lg` (28), decorativo |
| `style` | `ViewStyle` | não | - | |

Estados a implementar e verificar (o gap de estado é o mais caro do handoff; [Figma Blog, The Designer's Handbook for Developer Handoff, acesso 2026-06-20](https://www.figma.com/blog/the-designers-handbook-for-developer-handoff/)): default, pressed, disabled, loading, e **rótulo longo com fonte 1.3** (deve quebrar em duas linhas centradas, nunca truncar; não setar `numberOfLines`).

### 4.2 [P1] `BigButton`: `hint` desaparece quando o botão está desabilitado

**Arquivo:** `big-button.tsx:73`: `{hint === undefined || disabled ? null : ...}`.

Quando o alimentador está offline, o usuário perde ao mesmo tempo o botão e a explicação do que ele faria. O `disabledReason` diz por que não dá, mas não o que era. Correção: mostrar os dois, `disabledReason` primeiro em `colors.muted`/`type.label`, `hint` abaixo com `opacity: 0.7`.

### 4.3 [P1] `Card` com título em caixa alta e `letterSpacing` fixo

**Arquivo:** `card.tsx:35-41`: `fontSize: 16, textTransform: 'uppercase', letterSpacing: 0.5`, cor `muted`.

Caixa alta reduz velocidade de leitura por eliminar o perfil da palavra, e `letterSpacing` numérico fixo não acompanha ampliação de espaçamento de texto ([WCAG 2.1 SC 1.4.12 Text Spacing, via Deque University, acesso 2026-06-20](https://dequeuniversity.com/resources/wcag2.1/1.4.12-text-spacing)).

**Correção.** Título do card: `type.label` (16/600), **sem** `textTransform`, `letterSpacing: 0`, cor `colors.text` (18.9:1 contra branco; contra `colors.surface` #F2F4F7 dá 17.1:1). O papel de "rótulo de seção" passa a ser marcado por peso e posição, não por caixa alta.

### 4.4 [P2] `Stepper` sem toque-e-segure para repetir

**Arquivo:** `stepper.tsx:34-50`. Ir de 5 a 200 g com `GRAMS_STEP = 5` são 39 toques. Calibração vai de 50 a 2000 em passos de 50: 39 toques.

**Correção.** Adicionar repetição em pressão longa: `onLongPress` inicia `setInterval` de 300 ms; após 1,5 s de pressão, acelera para 120 ms; `onPressOut` limpa. Não substitui o toque simples e não introduz arraste (a decisão de não ter slider está certa e fica; ver §7). `Haptics.selectionAsync()` a cada repetição, se `expo-haptics` for adicionado. `(inferido)` nos valores de intervalo.

### 4.5 [P2] `Stepper`: `accessibilityLiveRegion` no valor gera verborragia

**Arquivo:** `stepper.tsx:66-70`. Cada toque anuncia "Tempo de ração: 8 s" inteiro. Em 39 toques seguidos, o TalkBack fica ininterrupto.

**Correção.** Trocar `accessibilityRole` do bloco inteiro para `adjustable` com `accessibilityValue={{ min, max, now: value, text: display }}` e `onAccessibilityAction` para `increment`/`decrement`, e **remover** o `accessibilityLiveRegion`. O leitor de tela passa a anunciar só o valor novo, e o gesto nativo de ajuste funciona. Papel e estado corretos são requisito (WCAG 2.2 SC 4.1.2, mesma prática já aplicada em `option-row.tsx` e `day-chips.tsx`).

---

## 5. Varredura tela a tela

### 5.1 Home (`src/app/(tabs)/index.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| H1 | P0 | `huge` no ALIMENTAR AGORA (`:183`): 120 dp de caixa, rótulo 40 dp que vira 56 dp no zoom da mãe | `emphasis` (64 dp), rótulo `type.title` (24), ícone `restaurant` 28 dp, `hint` mantido |
| H2 | P0 | Quatro `BigButton` largura total empilhados (`:181-209`), todos com peso parecido: Alimentar, Pular, Sirene, Sair. Em zoom alto, a tela passa de 3 alturas de viewport e o "Sair" fica visualmente tão importante quanto "Alimentar" | Reordenar e re-hierarquizar: (1) ALIMENTAR AGORA `emphasis` primary; (2) **Tocar sirene** secondary 56 dp; (3) **Pular próxima refeição** danger 56 dp, com `marginTop: 24` separando da anterior (ação de exceção, longe do fluxo comum, Fitts invertido para ação com consequência); (4) **Sair** deixa de ser botão: vira link de texto centralizado, `type.label`, `colors.blue`, `minHeight: control.sm` (44), com `marginTop: 32` e separado por uma régua `borderTopWidth: 1, borderTopColor: colors.border` |
| H3 | P1 | "Última refeição" e "Próxima refeição" em dois `Card` separados (`:147-165`), cada um com título, borda, padding 16: ~200 dp para duas linhas de informação | Fundir em um `Card` único, título "Refeições", com duas linhas rotuladas (`Última` / `Próxima`) usando o mesmo padrão do `FooterLine` (rótulo `type.label` muted à esquerda, valor `type.bodyBold` à direita). Economiza ~90 dp e junta informação relacionada |
| H4 | P1 | `formatNextMealMoment` (`format.ts:248-253`) decide "hoje / amanhã" comparando **só a hora**, ignorando `meal.days`. Uma refeição só de segunda, vista num sábado às 6h, é anunciada como "hoje às 07:00" | Corrigir a função para percorrer os próximos 7 dias a partir de `now`, achando o primeiro dia que está em `meal.days`, e rotular `hoje` / `amanhã` / `na terça` (usando `DAY_ARTICLE` + `dayName`, já existentes em `format.ts:163,170`). É defeito de conteúdo com custo de confiança: o app mente para quem confia nele para alimentar um animal |
| H5 | P1 | `state.skipNext` só aparece como linha de texto âmbar dentro do card (`:157-159`). É o estado em que **a comida não vai sair**, e está tipograficamente menor que a hora | Quando `skipNext === true`: o bloco "Próxima" ganha fundo `colors.amberSurface`, borda 2 dp `colors.amber`, símbolo `!` de 24 dp à esquerda, texto "Esta refeição vai ser pulada" em `type.bodyBold` cor `colors.text` (16.4:1 sobre amberSurface, medido), e um botão secundário "Não pular mais" logo abaixo, se o provider expuser o comando de desfazer. Undo explícito é rota de escape ([NN/G, 10 Usability Heuristics, User Control and Freedom, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)) |
| H6 | P1 | `styles.spacer` de 4 dp (`:229-231`, `:180`) entre o Stepper e o botão gigante: separação insuficiente entre "escolher quantidade" e "servir agora", que são passos distintos | Trocar por `marginTop: spacing.lg` (24) no `BigButton`, e remover o `View` espaçador (espaçador vazio como componente é dívida; espaçamento é propriedade do elemento) |
| H7 | P2 | `Alert.alert('Pronto', ...)` (`:63`) em toda ação bem-sucedida: 2 toques para servir comida, e a confirmação de sucesso exige um terceiro toque para dispensar | Sucesso vira faixa não modal no topo da tela: fundo `colors.greenSurface`, borda 2 dp `colors.green`, símbolo `✓`, texto em `colors.text`, `accessibilityLiveRegion="polite"`, auto-dispensa em 4 s. **Erro continua em `Alert`** (bloqueia e exige reconhecimento, que é o certo). Sucesso não precisa bloquear ([NN/G, Visibility of System Status, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)) |
| H8 | P2 | `scaleGrams` mostrado dentro do card "Próxima refeição" (`:160-164`), onde não pertence | Mover a leitura de peso para dentro do `FeederStatusPanel`, como terceira linha, ou para o card fundido do H3 como linha própria "Peso no prato" |

### 5.2 Agenda (`src/app/(tabs)/agenda.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| A1 | P0 | O `MealEditor` (`:349-421`) é um `Modal` **sem `ScrollView`**. Conteúdo: título + 3 `Stepper` (cada um ~100 dp) + `DayChips` (~90 dp) + 2 `BigButton` + gaps = **~640 dp**. Numa tela de 360x640 com fonte 1.3, o botão "Guardar na lista" fica fora da tela e é inalcançável. A refeição não pode ser salva | Envolver o conteúdo do `modalCard` em `<ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">`, com `modalCard` recebendo `maxHeight: '90%'`. **E** fixar os dois botões fora do scroll, no rodapé do card, com `borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16`, para "Guardar na lista" estar sempre visível |
| A2 | P1 | "Mudar" e "Apagar" colados, gap 8 dp (`:444`), com o destrutivo à direita, onde o polegar cai | Gap entre eles sobe para `spacing.lg` (24). "Apagar" perde o `borderColor: red` do repouso e fica `colors.border` com o texto em `colors.red`; a cor vermelha plena aparece só no pressed. Ação destrutiva grudada na comum viola Fitts e convida o toque errado ([Fitts, 1954](https://www.lri.fr/~mbl/ENS/FONDIHM/2013/papers/Fitts-JEP54.pdf); [NN/G, Error Prevention, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)) |
| A3 | P1 | `MealRow` (`:277-295`) é linha horizontal fixa: info à esquerda + 2 botões de 88 dp. Com fonte 1.3, "07:00" vira 39 dp e "Todos os dias" quebra em 3 linhas contra 176 dp de botões | Layout responsivo: se `fontScale >= 1.3` (via `useDensity`), `MealRow` vira coluna: bloco de info em cima, e os dois botões abaixo lado a lado com `flexBasis: 0 / flexGrow: 1` e gap 24 |
| A4 | P1 | Card "Gravado no alimentador" (`:167-183`) repete, numa string concatenada com `·`, exatamente a mesma lista que aparece logo abaixo em cartões. Redundância pura quando não há rascunho | Quando **não** houver `pending`, o card some e é substituído por uma linha discreta acima da lista: `✓ Igual ao que está gravado no aparelho`, `type.label`, `colors.green`. Quando **houver** `pending`, o card volta com o título "Gravado hoje no aparelho" e mostra a lista do aparelho, para o usuário comparar antes e depois. O `modeHint` (`:182`) migra para uma linha só, no topo, fora do card |
| A5 | P1 | Estado vazio (`:193-198`): "Nenhuma refeição na lista. Toque em Adicionar refeição para criar a primeira." Texto em `colors.muted` dentro de um `Card` sem título; parece erro, não onboarding | Estado vazio com estrutura: ícone `schedule` 40 dp em `colors.muted`; título "Nenhum horário programado" em `type.title`, `colors.text`; corpo "O alimentador só serve nos horários que você criar aqui. Cada horário tem hora, quantidade e dias da semana."; e um `BigButton` primary **dentro** do bloco vazio, "Criar o primeiro horário". Estado vazio é onboarding e traz a próxima ação ([NN/G, Designing Empty States in Complex Applications, 2021-09-19](https://www.nngroup.com/articles/empty-state-interface-design/)) |
| A6 | P1 | Botão "SALVAR NO ALIMENTADOR" (`:223-234`) fica no fim de uma lista que pode ter 8 refeições: com fonte grande, fica a ~1400 dp de scroll do topo. O usuário edita, não vê o botão, sai da tela e perde tudo silenciosamente | Barra fixa no rodapé (`position: absolute`, acima da tab bar, fundo `colors.background`, `borderTopWidth: 1`, padding 16, respeitando `insets.bottom`) que aparece **só quando `pending === true`**, contendo o botão SALVAR `emphasis` e, à esquerda, o link "Descartar". O `Screen` ganha `contentContainerStyle.paddingBottom` extra de 96 dp quando a barra está visível |
| A7 | P1 | Sair da tela com `draft` não salvo perde a edição sem aviso | `useFocusEffect` do expo-router + listener de `beforeRemove` na navegação: se `pending`, `Alert` com "Você mexeu nos horários e não salvou. Sair mesmo?" e opções "Voltar e salvar" (default) / "Sair sem salvar" (destructive). Prevenção de erro antes do fato ([NN/G, Error Prevention, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)) |
| A8 | P1 | CAIXA ALTA no rótulo do botão principal (`:224`) e no texto de aviso (`:188`) | "Salvar no alimentador". Caixa alta prejudica a leitura sem ganhar hierarquia (a hierarquia já vem de cor, tamanho e posição) |
| A9 | P2 | `key={`${meal.h}-${meal.m}-${index}`}` (`:202`): duas refeições no mesmo horário compartilham prefixo e o índice muda ao remover, causando remount e possível troca de estado visual | Gerar `id` estável por refeição no parse, ou usar `useId`. Impacto visual: animação/estado errado ao apagar item do meio |
| A10 | P2 | O editor não mostra qual horário está sendo editado no título (`:352-354`: só "Mudar refeição") | "Mudar refeição das 07:00", com a hora original. Reduz a chance de editar a refeição errada em uma lista de 8 |

### 5.3 Ajustes (`src/app/(tabs)/ajustes.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| S1 | P1 | Botão SALVAR no meio da tela (`:320-331`), com o card "Balança" e o rodapé técnico **abaixo** dele. O usuário mexe na balança e o botão de salvar já ficou para trás | Mesma barra fixa do A6, com as mesmas regras. O botão inline sai |
| S2 | P1 | Sete cards de stepper todos expandidos, ordenados sem critério de frequência: Modo, Dose rápida, Motor, Limite de segurança, Sirene, Gramas por segundo | Reordenar por frequência de uso e agrupar por risco: **(1) Dose rápida**, **(2) Sirene**, **(3) Modo de dosagem**, e então uma seção "Avançado" com `Motor`, `Limite de segurança` e `Gramas por segundo`, colapsada por padrão em um `Pressable` de `control.lg` com rótulo "Ajustes avançados" + `▸ / ▾`, `accessibilityRole="button"` + `accessibilityState={{ expanded }}`. Reduz a tela de ~2200 dp para ~900 dp no estado default |
| S3 | P1 | "Gramas por segundo (estimativa)" tem o parágrafo mais longo do app (`:301-305`, 4 linhas em 16 dp) e é o ajuste mais raro | Vai para "Avançado". Descrição encurta para: "Quantas gramas saem em um segundo de rosca. Só importa quando um horário foi criado em segundos e o aparelho está pesando em gramas." O restante vira `accessibilityHint` |
| S4 | P1 | Estado "sem config" (`:87-104`) diz "Ainda não recebemos os ajustes gravados no alimentador" e para aí: sem indicação de progresso e sem saída | Adicionar `ActivityIndicator` 32 dp acima do texto, título "Buscando os ajustes", e, após 10 s sem resposta, trocar por estado de erro: símbolo `!`, "Não conseguimos falar com o alimentador", corpo "Confira se ele está ligado e na tomada." e `BigButton` secondary "Tentar de novo". Carregando, vazio e erro não podem compartilhar visual ([NN/G, Response Time Limits, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/); NN/G, empty states, 2021-09-19) |
| S5 | P1 | Aviso âmbar de mudança de modo (`:198-203`) usa `type.label` (16) em `colors.amber` sobre fundo branco, e o card "pendente" no topo repete a mesma informação | Manter só o aviso local, promovido: fundo `colors.amberSurface`, borda 2 dp `colors.amber`, símbolo `!`, texto em `colors.text` (não em `amber`), `type.body`. O card pendente do topo (`:172-178`) fica, mas passa a ser genérico ("Há mudanças não salvas") e some quando a barra fixa do S1 estiver visível, para não haver dois avisos da mesma coisa |
| S6 | P2 | `TechnicalFooter` (`:411-418`) usa `FooterLine` com `justifyContent: 'space-between'` e ambos os textos com `flexShrink: 1`. Com fonte grande, "Versão do firmware" e o valor colidem no meio | Quando `fontScale >= 1.3`, `FooterLine` vira `flexDirection: 'column'`, rótulo acima e valor abaixo alinhado à esquerda |
| S7 | P2 | "Zerar a balança (tara)" (`:354`): jargão entre parênteses no rótulo do botão | Rótulo: "Zerar a balança". A palavra "tara" vai para o `hint`: "Também chamado de tara" |

### 5.4 Histórico (`src/app/(tabs)/historico.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| X1 | P1 | O aviso "a lista recomeça ao fechar o app" (`:23-27`) ocupa o topo permanentemente, em `Card` completo, empurrando o conteúdo real para baixo | Mover para o **fim** da lista, como texto solto em `type.label`/`colors.muted`, sem `Card`. No estado vazio, o aviso sobe e vira parte do texto explicativo |
| X2 | P1 | Estado vazio (`:29-32`): "Nada aconteceu ainda." e nada mais | Símbolo `list-alt` 40 dp em `colors.muted`; título "Nada aconteceu ainda" em `type.title`; corpo "Aqui vão aparecer as refeições servidas, os avisos de sirene e os problemas, conforme forem acontecendo. A lista recomeça toda vez que o aplicativo é aberto." |
| X3 | P1 | Sem agrupamento por dia: 100 eventos (`MAX_EVENTS_IN_MEMORY`) viram 100 cartões iguais | Cabeçalho de grupo por dia ("Hoje", "Ontem", "12/08") em `type.label` sem caixa alta, `colors.muted`, `marginTop: 24`. `formatMoment` já distingue hoje/ontem (`format.ts:226-240`); reaproveitar |
| X4 | P1 | O evento de falha (`meal_failed`) tem exatamente o mesmo cartão de um sucesso, mudando só a cor do glifo (`:45-46`) e o texto. Distinção de estado apoiada demais em matiz | Falha ganha fundo `colors.redSurface` e borda `colors.red` (o glifo `!` já existe, `format.ts:303`). Cor reforça, não carrega sozinha ([WebAIM, Contrast and Color Accessibility, acesso 2026-06-20](https://webaim.org/articles/contrast/)) |
| X5 | P2 | "Limpar a lista" (`:38`) apaga tudo **sem confirmação**, ao contrário de todas as outras ações destrutivas do app, que confirmam | `Alert.alert('Limpar a lista?', 'Os avisos já mostrados somem desta tela. Isso não mexe no alimentador.', [{text:'Não', style:'cancel'}, {text:'Limpar', style:'destructive'}])`. Consistência com o padrão já estabelecido no resto do app |
| X6 | P2 | `styles.symbol` com `width: 28` fixo (`:78-82`) e `fontSize: 24` sem cap: em fonte grande o glifo transborda a coluna | `width: 32`, `textAlign: 'center'`, `maxFontSizeMultiplier={fontCap.display}` (1.2) |

### 5.5 `FeederStatusPanel` (`src/components/feeder-status.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| F1 | P1 | **Contraste medido:** `colors.green` #1B7F3B sobre `colors.greenSurface` #E4F3E9 = **4.41:1**. Reprova o 4.5:1 de texto normal e só passa porque `headline` é 24/700 (texto grande, limiar 3:1). Uma redução futura do headline abaixo de 24 quebra a conformidade sem ninguém perceber. Limiar não se arredonda: 4.41 reprova em 4.5 ([WCAG 2.2 SC 1.4.3, W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)) | `styles.headline` passa a usar `colors.text` (#111111): 16.4:1 sobre `greenSurface`, 15.5:1 sobre `redSurface`, 15.9:1 sobre `amberSurface`. A cor de tom fica **só** no glifo (que é grande, 40 dp) e na borda de 2 dp (limiar de componente 3:1, atendido). Ganha robustez sem trocar nenhum token de cor |
| F2 | P2 | `styles.symbol` `fontSize: 40` sem cap e sem `lineHeight`: em fonte grande o glifo estica a altura do painel inteiro | `maxFontSizeMultiplier={fontCap.display}` (1.2), `lineHeight: 46`, `width: 48`, `textAlign: 'center'` |
| F3 | P2 | O painel de status ocupa ~120 dp no topo da Home mesmo quando o estado é "tudo certo", que é o caso 95% do tempo | Quando `tone === 'ok'`: painel compacto de uma linha, `minHeight: 48`, glifo 24 dp, só o `headline`; o `detail` some (continua no `accessibilityLabel`). Nos tons `bad` e `wait`, o painel completo permanece. Sinal de erro merece mais espaço que sinal de normalidade |

### 5.6 Tab bar (`src/app/(tabs)/_layout.tsx`)

| # | Prio | Problema | Correção concreta |
|---|---|---|---|
| T1 | P1 | `height: 86` **fixo** (`:21`) mais `paddingBottom: 12`, ignorando `insets.bottom`. Em Android edge-to-edge (RN 0.86) e iPhone com barra de gestos, os rótulos ficam sob a barra do sistema | `const insets = useSafeAreaInsets()`; `height: 64 + insets.bottom`, `paddingBottom: 8 + insets.bottom`, `paddingTop: 8` |
| T2 | P1 | `tabBarLabelStyle` com `fontSize: 16` e sem cap: em fonte 1.5 vira 24 dp e "Histórico" não cabe em 1/4 da largura, truncando para "Histó..." | `fontSize: 14`, `maxFontSizeMultiplier: 1.2` (via `tabBarLabelStyle` + `tabBarAllowFontScaling`), ícone de 30 para `iconSize.lg` (28). Rótulo de aba abaixo do piso de 16 do app é a exceção consciente e justificada: o alvo de toque continua sendo a célula inteira de ~64 dp de altura, muito acima de 24x24 ([WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), e truncar o rótulo custaria mais legibilidade do que 2 dp de fonte |
| T3 | P2 | Aba ativa distinguida só por cor (`tabBarActiveTintColor`) | Adicionar `tabBarActiveBackgroundColor: colors.blueSurface` com `borderRadius` na célula ativa, ou variante preenchida do ícone quando ativo. Estado não deve depender só de matiz ([WCAG 2.2 SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)) |

---

## 6. Tokens: higiene

| # | Prio | Problema | Correção |
|---|---|---|---|
| K1 | P1 | Hex hardcoded no componente: `big-button.tsx:96` `pressed: '#14602C'` e `agenda.tsx:488` `'rgba(0,0,0,0.55)'` | Promover a tokens semânticos: `colors.greenPressed = '#14602C'` e `colors.scrim = 'rgba(0,0,0,0.55)'`. Hex chumbado no componente impede tema e espalha a mudança ([DTCG Design Tokens Format Module, 2026-06-17](https://www.designtokens.org/tr/drafts/format/)) |
| K2 | P2 | Tokens nomeados pelo **valor**, não pela intenção: `colors.green`, `colors.blue`, `colors.red`, `colors.amber` | Camada semântica por cima, mantendo a base: `color.feedback.success -> {green}`, `color.feedback.danger -> {red}`, `color.feedback.warning -> {amber}`, `color.action.primary -> {green}`, `color.action.secondary -> {blue}`. Nome por intenção desacopla decisão de valor ([Nathan Curtis, Naming Tokens in Design Systems, EightShapes, 2020-10-15, acesso 2026-06-20](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676)). **Não urgente**: com tema único e sem dark mode, o ganho é de manutenção, não de função |
| K3 | P2 | `colors.disabled` #6B7280 sobre `colors.disabledSurface` #E3E5E8 = **3.83:1** (medido), abaixo de 4.5:1 | Formalmente conforme: componentes inativos são explicitamente isentos do requisito de contraste ([WCAG 2.2 SC 1.4.3, exceção "Incidental", W3C, Rec 2023-10-05](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). Ainda assim, como o app tem público 50+ e o botão desabilitado carrega informação útil (o motivo), recomendo escurecer `colors.disabled` para **#5B6270** (4.75:1 sobre `disabledSurface`, medido) e manter o `disabledReason` sempre em `colors.muted` sobre branco (8.9:1) |
| K4 | P2 | `MIN_TOUCH` e `MIN_CHIP_TOUCH` seguem existindo depois de `control.*` | Marcar com `@deprecated` no JSDoc apontando o substituto, e remover só na versão seguinte. Deletar token abruptamente quebra consumidor sem rota de migração ([DTCG, 2026-06-17](https://www.designtokens.org/tr/drafts/format/)) |
| K5 | P2 | Comentário de contraste no `theme.ts:1-12` lista só pares contra **branco**, e o app usa vários pares contra `surface` e contra as cores `*Surface` | Ampliar a tabela do comentário com os pares reais medidos: `green/greenSurface = 4.41` (só passa como texto grande), `red/redSurface = 5.57`, `amber/amberSurface = 5.30`, `border/white = 3.25`, `disabled/disabledSurface = 3.83`, `muted/surface = 8.04`, `text/surface = 17.1`. Todos medidos sem arredondamento, conforme o método normativo |

---

## 7. O que NÃO mudar

Isto está certo e a implementação deve preservar. Se alguma dessas propriedades cair na refatoração, é regressão.

1. **Confirmação antes de toda ação barulhenta ou irreversível.** Servir comida (`index.tsx:76-86`), pular refeição (`:88-102`), tocar sirene (`:107-126`, que ainda informa a duração), sair (`:128-139`), apagar horário (`agenda.tsx:124-134`), salvar agenda (`:136-163`), mudar modo (`ajustes.tsx:128-136`), zerar e calibrar balança (`:138-168`). Prevenir a condição de erro é mais eficaz do que a melhor mensagem de erro ([NN/G, Error Prevention, 2024-01-30](https://www.nngroup.com/articles/ten-usability-heuristics/)). A única confirmação **faltando** é "Limpar a lista" no histórico (X5).
2. **Texto + símbolo em todo estado, nunca cor sozinha.** `✓ / ✕ / … / ! / ♪ / ⚙` (`format.ts:300-318`, `feeder-status.tsx`, `toggle.tsx:48`, `option-row.tsx:36-38`, `day-chips.tsx:55-59`). Isso resolve o app inteiro para daltonismo e é a decisão mais bem executada do código ([WCAG 2.2 SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).
3. **Zero arraste em qualquer lugar.** Sem slider, sem swipe-to-delete, sem reordenação por drag. `Toggle` substitui o `Switch` nativo por um toque, `Stepper` substitui slider por dois botões. Está documentado no código (`toggle.tsx:14-21`, `stepper.tsx:18-22`, `day-chips.tsx:15-20`) e atende SC 2.5.7. A repetição em pressão longa proposta em §4.4 **não** viola isso: é pressão, não arraste, e o toque simples continua funcionando.
4. **Rótulo escrito em toda aba, ícone como reforço** (`_layout.tsx:6-11`). Correto para o público. Ícone sozinho nunca.
5. **Modelo de rascunho explícito** em Agenda e Ajustes (`draft === null` significa "seguindo o aparelho"): nada é enviado sozinho, o aviso âmbar diz que há mudança pendente, e o botão de salvar se desabilita com motivo escrito quando nada mudou. É controle e liberdade bem feitos; a única falha é o botão ficar longe (A6/S1), não o modelo.
6. **Português simples, sem jargão, com o "porquê" junto.** `modeExplanation` (`format.ts:84-97`), `hint` dos botões, `disabledReason` sempre preenchido, `formatDays` traduzindo `[1,2,3,4,5]` para "Seg a sex". A tela de Ajustes é do dev e mesmo assim fala em linguagem de gente, o que está declarado no comentário (`ajustes.tsx:51-58`) e deve continuar.
7. **`disabledReason` como texto visível, não só como estado.** Botão cinza sem explicação é o padrão comum e é ruim; aqui todo bloqueio diz o motivo ("Só dá para mandar comando com o alimentador ligado"). Preservar em toda refatoração do `BigButton`.
8. **Nomes acessíveis por extenso.** Chip anuncia "sábado", não "S" (`day-chips.tsx:34`); `RowButton` anuncia "Apagar refeição das 07:00", não "Apagar" (`agenda.tsx:291`). Isso é o que faz o app funcionar com TalkBack e não pode se perder ao mexer no layout.
9. **Tema claro único, sem dark mode** (`theme.ts:1-2`, `app.json` `userInterfaceStyle: light`). Decisão consciente e certa para o público. Não introduzir dark mode nesta rodada.
10. **`useNow` recebendo o "agora" por parâmetro nas funções de formatação** (`format.ts:6-10`). Não é design de UI, mas garante que "hoje / ontem" atualiza sozinho na tela sem remount. Preservar ao mexer em `formatNextMealMoment` (H4).

---

## 8. Ordem de implementação sugerida

**Lote 1 (P0, resolve o que quebra hoje):** §2.1 chips, §3.1 teclado no login, §1.1 tokens de controle, §1.2 fim do `huge`, §1.3 regra de font scaling, A1 scroll no editor modal, H1/H2 hierarquia da Home.

**Lote 2 (P1):** barra fixa de salvar (A6, S1), estados vazios (A5, X2), H4 bug do "hoje/amanhã", A2 separação do destrutivo, F1 headline em `colors.text`, T1/T2 tab bar, §1.4 densidade adaptativa, §1.5 lineHeight, §2.3 atalhos de dias, S2 seção avançada, §3.2 a §3.4 login.

**Lote 3 (P2):** o resto.

---

## 9. Critérios de aceite auditáveis

Antes de fechar, no **celular da mãe** (ou emulador com fonte no máximo e densidade de tela aumentada):

1. Editor de refeição: os 7 chips ficam em **uma linha**, com larguras iguais, nenhum órfão, nenhum esticado.
2. Editor de refeição: "Guardar na lista" visível sem rolar.
3. Login: ao focar Senha, campo e botão Entrar visíveis acima do teclado.
4. Home: cabe da barra de status ao botão ALIMENTAR AGORA sem rolar.
5. Nenhum controle passa de 64 dp de altura.
6. Nenhum rótulo truncado com `...` em nenhuma tela.
7. Todo texto de conteúdo escala sem cap; nenhum `allowFontScaling={false}` no código.
8. Contraste: nenhum par texto/fundo abaixo de 4.5:1 medido sem arredondar, exceto texto grande (>= 24 dp normal ou >= 18.5 dp bold) em 3:1, e componentes inativos, que são isentos.
9. TalkBack: percorrer Home inteira e Agenda inteira sem encontrar controle anunciado só como "botão" sem nome, ou estado não anunciado.

---

## Notas de procedência

Os itens sobre contraste, alvo, cor como canal único, estados vazios, mensagens de erro, feedback, hierarquia, grid de 8 dp, tokens e especificação de componente saem da doutrina de design da casa, com as fontes citadas item a item (WCAG 2.2 / W3C, Material Design 2 e 3, DTCG Design Tokens Format Module, Nielsen Norman Group, WebAIM, Deque, EightShapes / Nathan Curtis, Figma Learn e Best Practices).

**Fora da cobertura da doutrina** (marcados `(inferido)` no texto): valores específicos de `maxFontSizeMultiplier` de React Native, comportamento de `lineHeight` sob `fontScale` em RN, causa-raiz do teclado sob edge-to-edge no Android e os intervalos de repetição em pressão longa. Nada disso é norma; é engenharia de plataforma, e o dev que implementar deve validar no aparelho.

**Decisão registrada:** §1.6, escala tipográfica mantida em piso 16 / corpo 20, decidida pelo Giovanni em 2026-08-17.
