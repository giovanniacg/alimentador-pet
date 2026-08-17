import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Altura que o teclado cobre da tela, em dp, ou 0 quando ele esta fechado.
 *
 * Existe porque no Android edge-to-edge (padrao no React Native 0.86) a janela
 * nao e mais redimensionada quando o teclado abre: o teclado simplesmente
 * cobre o conteudo, e o `KeyboardAvoidingView` sem `behavior` vira inerte.
 * Medindo a altura real do teclado, a mesma conta serve para os dois sistemas.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setInset(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
