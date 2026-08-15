/**
 * Polyfills que a mqtt.js espera do ambiente de navegador e o React Native
 * nao entrega inteiro. Importar ANTES de qualquer coisa que toque em mqtt.
 *
 * O bundle `dist/mqtt.esm.js` (condicao "react-native" no package.json da
 * mqtt) ja embute Buffer e process, mas outras dependencias podem alcancar os
 * globais; deixar aqui e barato e evita crash em runtime.
 */
import { Buffer } from 'buffer';
import process from 'process';
import 'react-native-url-polyfill/auto';

type MutableGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: typeof process;
};

const target: MutableGlobal = globalThis;

if (target.Buffer === undefined) {
  target.Buffer = Buffer;
}

if (target.process === undefined) {
  target.process = process;
}

export {};
