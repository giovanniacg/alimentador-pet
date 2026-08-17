#include "agenda.h"
#include "relogio.h"
#include "config.h"
#include <Preferences.h>

static Refeicao refeicoes[MAX_REFEICOES];
static uint8_t  quantidade = 0;
static bool     skipProxima = false;

// Quais refeicoes ja foram servidas HOJE. Um bit por indice da agenda, mais
// o dia do mes a que a mascara pertence. Guardar so a "ultima servida" nao
// bastava: com duas refeicoes dentro da mesma janela de atraso, servir a
// segunda liberava a primeira para ser servida de novo.
static uint8_t diaDaMascara = 0;
static uint8_t mascaraServidas = 0;

static void zerarMascaraSeVirouODia() {
  uint8_t hoje = relogioAgora().day();
  if (hoje != diaDaMascara) {
    diaDaMascara = hoje;
    mascaraServidas = 0;
  }
}

static void salvar() {
  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, false);
  nvs.putUChar("n_ref", quantidade);
  // Chave "refeicoes2": o layout do struct mudou quando a refeicao ganhou o
  // campo segundos. Chave nova evita ler lixo de um firmware anterior.
  nvs.putBytes("refeicoes2", refeicoes, sizeof(Refeicao) * MAX_REFEICOES);
  nvs.putBool("skip", skipProxima);
  nvs.putUChar("dia_masc", diaDaMascara);
  nvs.putUChar("masc", mascaraServidas);
  nvs.end();
}

void agendaIniciar() {
  Preferences nvs;
  nvs.begin(NVS_NAMESPACE, true);
  quantidade    = nvs.getUChar("n_ref", 0);
  skipProxima   = nvs.getBool("skip", false);
  diaDaMascara    = nvs.getUChar("dia_masc", 0);
  mascaraServidas = nvs.getUChar("masc", 0);
  size_t lidos  = nvs.getBytes("refeicoes2", refeicoes, sizeof(Refeicao) * MAX_REFEICOES);
  nvs.end();

  if (lidos != sizeof(Refeicao) * MAX_REFEICOES || quantidade > MAX_REFEICOES) {
    quantidade = 0;
    memset(refeicoes, 0, sizeof(refeicoes));
  }
  logf("[agenda] %u refeicoes na NVS | skip=%s", quantidade, skipProxima ? "sim" : "nao");
}

uint8_t  agendaQuantidade() { return quantidade; }
Refeicao agendaItem(uint8_t i) { return refeicoes[i < MAX_REFEICOES ? i : 0]; }

bool agendaDefinir(const Refeicao *lista, uint8_t n) {
  if (n > MAX_REFEICOES) n = MAX_REFEICOES;
  for (uint8_t i = 0; i < n; i++) {
    if (lista[i].hora > 23 || lista[i].minuto > 59) {
      logf("[agenda] recusada: hora invalida %u:%u", lista[i].hora, lista[i].minuto);
      return false;
    }
    // Cada refeicao precisa trazer PELO MENOS um dos dois: secs (modo timer)
    // ou grams (modos scale). O que faltar sai por conversao na hora de dosar.
    if (lista[i].gramas == 0 && lista[i].segundos == 0) {
      logf("[agenda] recusada: refeicao %u sem secs nem grams", i);
      return false;
    }
    if (lista[i].gramas > 500) {
      logf("[agenda] recusada: gramas fora da faixa (%u)", lista[i].gramas);
      return false;
    }
    if (lista[i].segundos > configAtual().maxSecs) {
      logf("[agenda] recusada: secs acima do teto de %u s (%u)",
           configAtual().maxSecs, lista[i].segundos);
      return false;
    }
  }
  memset(refeicoes, 0, sizeof(refeicoes));
  for (uint8_t i = 0; i < n; i++) refeicoes[i] = lista[i];
  quantidade = n;
  // Agenda nova invalida os indices da mascara: comeca do zero.
  diaDaMascara = 0;
  mascaraServidas = 0;
  salvar();
  logf("[agenda] gravadas %u refeicoes", quantidade);
  return true;
}

bool agendaProxima(Refeicao &saida) {
  if (quantidade == 0) return false;
  DateTime agora = relogioAgora();
  int minutosAgora = agora.hour() * 60 + agora.minute();

  int melhor = -1, melhorDelta = 100000;
  for (uint8_t i = 0; i < quantidade; i++) {
    int m = refeicoes[i].hora * 60 + refeicoes[i].minuto;
    int delta = m - minutosAgora;
    if (delta <= 0) delta += 24 * 60;      // rola para amanha
    if (delta < melhorDelta) { melhorDelta = delta; melhor = i; }
  }
  if (melhor < 0) return false;
  saida = refeicoes[melhor];
  return true;
}

bool agendaVencida(Refeicao &saida, uint8_t &indice, uint16_t janelaMin) {
  if (quantidade == 0) return false;
  zerarMascaraSeVirouODia();

  DateTime agora = relogioAgora();
  int minutosAgora = agora.hour() * 60 + agora.minute();

  for (uint8_t i = 0; i < quantidade; i++) {
    if (mascaraServidas & (1u << i)) continue;
    int m = refeicoes[i].hora * 60 + refeicoes[i].minuto;
    int atraso = minutosAgora - m;
    if (atraso < 0 || atraso > (int)janelaMin) continue;
    saida = refeicoes[i];
    indice = i;
    return true;
  }
  return false;
}

void agendaMarcarServida(uint8_t indice) {
  if (indice >= MAX_REFEICOES) return;
  zerarMascaraSeVirouODia();
  mascaraServidas |= (1u << indice);
  salvar();
}

bool agendaSkipProxima() { return skipProxima; }

void agendaSetSkipProxima(bool v) {
  skipProxima = v;
  salvar();
}

// Espelho do que esta gravado, no mesmo formato do cmd/schedule: cada meal
// sai com os campos que foram REALMENTE informados. Nao inventa o que faltou,
// porque a conversao depende do g_per_s vigente e pode mudar depois.
String agendaJson() {
  String s = "{\"meals\":[";
  for (uint8_t i = 0; i < quantidade; i++) {
    if (i) s += ',';
    s += "{\"h\":";  s += refeicoes[i].hora;
    s += ",\"m\":";  s += refeicoes[i].minuto;
    if (refeicoes[i].segundos > 0) { s += ",\"secs\":";  s += refeicoes[i].segundos; }
    if (refeicoes[i].gramas   > 0) { s += ",\"grams\":"; s += refeicoes[i].gramas; }
    s += '}';
  }
  s += "]}";
  return s;
}
