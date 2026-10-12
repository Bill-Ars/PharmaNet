/*
 * tema.js — camada base (utilitários).
 * Modo claro / escuro. O tema é o atributo data-tema no <html>.
 * A escolha da pessoa fica no localStorage (é só uma preferência visual, não um dado sensível).
 * Sem escolha guardada, segue o sistema e muda sozinho quando o sistema muda.
 * Usado pelas páginas (e, na Fase 2, pelo componente de navegação).
 */

const CHAVE = 'farmarede-tema';
const consultaEscuro = window.matchMedia('(prefers-color-scheme: dark)');

/** 'claro' ou 'escuro', tal como está aplicado agora. */
export function temaActual() {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

/**
 * Valor actual de um token CSS, já com o tema aplicado: lerToken('--cor-primaria') → '#0f766e'.
 * Usado pelos gráficos, que desenham num <canvas> e não lêem variáveis CSS sozinhos.
 */
export function lerToken(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** Troca entre claro e escuro, guarda a escolha e avisa quem estiver a ouvir. */
export function alternarTema() {
  const novo = temaActual() === 'escuro' ? 'claro' : 'escuro';
  guardarEscolha(novo);
  aplicarTema(novo);
  return novo;
}

/**
 * Liga o seguimento automático do sistema (quando não há escolha guardada).
 * O tema inicial já foi aplicado pelo script do <head>, para não haver «piscar».
 */
export function iniciarTema() {
  consultaEscuro.addEventListener('change', (evento) => {
    if (lerEscolha()) return; // a escolha da pessoa vence a do sistema
    aplicarTema(evento.matches ? 'escuro' : 'claro');
  });
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  // Os gráficos (Fase 8) ouvem este evento para trocarem de cores.
  document.dispatchEvent(new CustomEvent('tema-mudou', { detail: { tema } }));
}

// O localStorage pode estar bloqueado (modo privado, definições): nunca deixar a página falhar.
function lerEscolha() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function guardarEscolha(tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // sem armazenamento: o tema muda na mesma, só não fica lembrado
  }
}
