import { useEffect, useState } from 'react';

/**
 * Relogio da tela. Existe para o render continuar puro: em vez de chamar
 * Date.now() no meio do componente, a hora vem de um estado que um Effect
 * atualiza (sincronizar com sistema externo e exatamente o caso de Effect).
 */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
