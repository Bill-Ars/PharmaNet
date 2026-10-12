/*
 * dom.js — camada base (utilitários).
 * Funções pequenas para criar e encontrar elementos sem usar innerHTML.
 * Todo o texto entra por textContent, por isso dados do backend nunca viram HTML (sem XSS).
 * Usado por componentes e páginas.
 */

/**
 * Cria um elemento HTML.
 * @param {string} etiqueta  nome da tag, ex.: 'button'
 * @param {object} atributos atributos normais, mais estes especiais:
 *   classe  → string ou lista de classes (os valores falsos são ignorados)
 *   texto   → texto do elemento (via textContent)
 *   dados   → objecto copiado para dataset (data-*)
 *   onclick, oninput, … → funções ligadas com addEventListener
 * @param {Array|Node|string} filhos elementos ou textos a acrescentar
 * @returns {HTMLElement}
 */
export function criar(etiqueta, atributos = {}, filhos = []) {
  const elemento = document.createElement(etiqueta);
  for (const [nome, valor] of Object.entries(atributos)) {
    definirAtributo(elemento, nome, valor);
  }
  acrescentar(elemento, filhos);
  return elemento;
}

function definirAtributo(elemento, nome, valor) {
  // null, undefined e false querem dizer «sem este atributo».
  if (valor === null || valor === undefined || valor === false) return;

  if (nome === 'classe') {
    const classes = Array.isArray(valor) ? valor : [valor];
    elemento.className = classes.filter(Boolean).join(' ');
  } else if (nome === 'texto') {
    elemento.textContent = String(valor);
  } else if (nome === 'dados') {
    Object.assign(elemento.dataset, valor);
  } else if (nome.startsWith('on') && typeof valor === 'function') {
    elemento.addEventListener(nome.slice(2), valor);
  } else if (valor === true) {
    elemento.setAttribute(nome, '');
  } else {
    elemento.setAttribute(nome, String(valor));
  }
}

/**
 * Acrescenta filhos a um elemento. Aceita um só filho ou uma lista (até listas dentro de listas).
 * Textos viram nós de texto; null, undefined e false são ignorados.
 */
export function acrescentar(elemento, filhos) {
  const lista = Array.isArray(filhos) ? filhos.flat(Infinity) : [filhos];
  for (const filho of lista) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

/** Remove todos os filhos de um elemento. */
export function limpar(elemento) {
  elemento.replaceChildren();
  return elemento;
}

/** Substitui todo o conteúdo de um elemento pelos novos filhos. */
export function substituir(elemento, filhos) {
  limpar(elemento);
  return acrescentar(elemento, filhos);
}

/**
 * Põe data-rolado="true" no elemento quando a página já rolou um pouco
 * (o cabeçalho usa-o para mostrar a sombra só nessa altura).
 */
export function marcarRolagem(elemento, limitePx = 4) {
  const actualizar = () => {
    elemento.dataset.rolado = String(window.scrollY > limitePx);
  };
  window.addEventListener('scroll', actualizar, { passive: true });
  actualizar();
}

/** Primeiro elemento que corresponde ao selector (ou null). */
export function $(seletor, raiz = document) {
  return raiz.querySelector(seletor);
}

/** Todos os elementos que correspondem ao selector, já como Array. */
export function $$(seletor, raiz = document) {
  return [...raiz.querySelectorAll(seletor)];
}
