import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDensity } from '@/hooks/use-density';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { colors, fontCap, spacing, type } from '@/theme';

/** Qualquer coisa que saiba dizer onde esta na janela: `View`, `TextInput`. */
type Measurable = {
  readonly measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

type RevealFn = (target: Measurable | null) => void;

const RevealContext = createContext<RevealFn>(() => undefined);

/**
 * Sobe a tela para deixar o campo focado acima do teclado.
 * Vale so dentro de uma `Screen` com `avoidKeyboard`; fora dela nao faz nada.
 */
export function useRevealAboveKeyboard(): RevealFn {
  return useContext(RevealContext);
}

type ScreenProps = {
  readonly title: string;
  readonly children: ReactNode;
  /** True em tela com campo de digitacao: ver `useKeyboardInset`. */
  readonly avoidKeyboard?: boolean;
  /**
   * Barra fixa no rodape, fora da rolagem. Fica abaixo do `ScrollView` na
   * mesma coluna, entao nao cobre conteudo nenhum e ja respeita a area segura
   * e a barra de abas.
   */
  readonly footer?: ReactNode;
};

/** Moldura comum das telas: area segura, titulo grande e rolagem. */
export function Screen({
  title,
  children,
  avoidKeyboard = false,
  footer,
}: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const targetRef = useRef<Measurable | null>(null);
  const insetRef = useRef(0);
  const windowHeightRef = useRef(0);

  const inset = useKeyboardInset();
  const density = useDensity();
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    insetRef.current = avoidKeyboard ? inset : 0;
    windowHeightRef.current = windowHeight;
  }, [avoidKeyboard, inset, windowHeight]);

  const reveal = useCallback<RevealFn>((target) => {
    if (target !== null) {
      targetRef.current = target;
    }
    const node = targetRef.current;
    const scroll = scrollRef.current;
    if (node === null || scroll === null || insetRef.current <= 0) {
      return;
    }
    node.measureInWindow((_x, y, _width, height) => {
      const keyboardTop = windowHeightRef.current - insetRef.current;
      // 24 dp de folga abaixo do campo, para ele nao encostar no teclado.
      const overlap = y + height + spacing.lg - keyboardTop;
      if (overlap > 0) {
        scroll.scrollTo({ y: offsetRef.current + overlap, animated: true });
      }
    });
  }, []);

  // O foco costuma chegar antes do teclado terminar de subir: quando a altura
  // do teclado muda, refaz a conta com o ultimo campo focado.
  useEffect(() => {
    if (avoidKeyboard && inset > 0) {
      reveal(null);
    }
  }, [avoidKeyboard, inset, reveal]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <RevealContext.Provider value={avoidKeyboard ? reveal : noReveal}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              padding: density.padding,
              gap: density.gap,
              paddingBottom: spacing.xl + (avoidKeyboard ? inset : 0),
            },
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={fontCap.title}>
            {title}
          </Text>
          <View style={[styles.body, { gap: density.gap }]}>{children}</View>
        </ScrollView>
      </RevealContext.Provider>
      {footer}
    </SafeAreaView>
  );
}

function noReveal(): void {
  return undefined;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...type.headline,
    color: colors.text,
  },
  body: {
    gap: spacing.md,
  },
});
