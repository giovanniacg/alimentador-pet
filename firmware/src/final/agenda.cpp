#include "agenda.h"
#include "relogio.h"
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
  nvs.putBytes("refeicoes", refeicoes, sizeof(Refeicao) * MAX_REFEICOES);
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
  size_t lidos  = nvs.getBytes("refeicoes", refeicoes, sizeof(Refeicao) * MAX_REFEICOES);
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
    if (lista[i].gramas == 0 || lista[i].gramas > 500) {
      logf("[agenda] recusada: gramas fora da faixa (%u)", lista[i].gramas);
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

String agendaJson() {
  String s = "{\"meals\":[";
  for (uint8_t i = 0; i < quantidade; i++) {
    if (i) s += ',';
    s += "{\"h\":";      s += refeicoes[i].hora;
    s += ",\"m\":";      s += refeicoes[i].minuto;
    s += ",\"grams\":";  s += refeicoes[i].gramas;
    s += '}';
  }
  s += "]}";
  return s;
}
