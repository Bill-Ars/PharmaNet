/*
 * formatar.js — camada base (utilitários).
 * Transforma números, tempos e textos em frases prontas a mostrar (em português).
 * Funções puras: não tocam no DOM nem em dados guardados.
 * Usado por páginas, componentes e pelo simulador.
 */

const formatoNumero = new Intl.NumberFormat('pt-PT');
const formatoDecimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const formatoHora = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** 1234 → «1234» com separadores portugueses (ex.: «12 345»). */
export function formatarNumero(numero) {
  return formatoNumero.format(numero);
}

/** Duração legível: 412 → «412 ms»; 1500 → «1,5 s». */
export function formatarDuracao(milissegundos) {
  if (milissegundos < 1000) return `${Math.round(milissegundos)} ms`;
  return `${formatoDecimal.format(milissegundos / 1000)} s`;
}

/** Hora do dia: «08:00:02». Aceita uma data ou um texto ISO. */
export function formatarHora(data) {
  return formatoHora.format(new Date(data));
}

/** Há quanto tempo: 3 → «há 3 s»; 125 → «há 2 min». */
export function haQuanto(segundos) {
  const inteiro = Math.max(0, Math.round(segundos));
  if (inteiro < 60) return `há ${inteiro} s`;
  return `há ${Math.floor(inteiro / 60)} min`;
}

/** Número com dois algarismos: 1 → «01» (índice dos cartões de farmácia). */
export function doisDigitos(numero) {
  return String(numero).padStart(2, '0');
}

/**
 * Texto em minúsculas e sem acentos, para comparar pesquisas:
 * «Ibuprofêno » → «ibuprofeno».
 */
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
