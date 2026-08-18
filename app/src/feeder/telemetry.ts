/**
 * Telemetria de diagnostico: manda linhas de log pro coletor /dbg que mora no
 * MESMO dominio do broker. Fire-and-forget: falha de telemetria nunca pode
 * atrapalhar o app. Existe porque falha que so acontece no APK de producao
 * nao tem console (2026-08-18). Nunca enviar senha por aqui.
 */
export function reportDebug(host: string, payload: Record<string, unknown>): void {
  const trimmed = host.trim().replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
  if (trimmed.length === 0) {
    return;
  }
  try {
    void fetch(`https://${trimmed}/dbg`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ at: new Date().toISOString(), ...payload }),
    }).catch(() => {
      // silencio: telemetria e melhor-esforco
    });
  } catch {
    // idem
  }
}
