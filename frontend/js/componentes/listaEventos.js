/*
 * listaEventos.js — camada de componentes.
 * Lista «Últimos eventos» do painel: hora, nó, tipo e uma frase curta.
 * listaEventos() desenha a lista; itemEvento() desenha uma linha, para a página
 * acrescentar os novos eventos por cima (com um desvanecimento).
 * Usado por paginas/painel.js.
 */
import { criar } from '../utilitarios/dom.js';
import { formatarHora } from '../utilitarios/formatar.js';

// Cada tipo de evento tem um rótulo e uma cor de etiqueta fixos.
const TIPOS = {
  vivo: { rotulo: 'Vivo', classe: 'etiqueta--lider' },
  lento: { rotulo: 'Lento', classe: 'etiqueta--replica' },
  indisponivel: { rotulo: 'Indisponível', classe: 'etiqueta--indisponivel' },
  conflito: { rotulo: 'Conflito 409', classe: 'etiqueta--erro' },
  escrita: { rotulo: 'Escrita', classe: 'etiqueta--primaria' },
  replica: { rotulo: 'Réplica', classe: 'etiqueta--replica' },
  modo: { rotulo: 'Modo', classe: 'etiqueta--contorno' },
  reposicao: { rotulo: 'Reposição', classe: 'etiqueta--contorno' },
};

/**
 * @param {Array<{id:string|number, hora:string, no:string, tipo:string, detalhe:string}>} eventos
 *        do mais recente para o mais antigo
 * @returns {HTMLElement}
 */
export function listaEventos(eventos) {
  // tabindex: no portátil a lista rola por dentro, e assim também rola com o teclado.
  return criar('ol', { classe: 'eventos', role: 'list', tabindex: '0', 'aria-label': 'Últimos eventos' }, eventos.map(itemEvento));
}

/** Uma linha da lista. */
export function itemEvento({ hora, no, tipo, detalhe }) {
  const dadosDoTipo = TIPOS[tipo] ?? { rotulo: tipo, classe: 'etiqueta--contorno' };
  return criar('li', { classe: 'evento' }, [
    criar('time', { classe: 'evento__hora', datetime: hora, texto: formatarHora(hora) }),
    criar('span', { classe: 'evento__no' }, [criar('span', { classe: 'visualmente-oculto', texto: 'Nó ' }), no]),
    criar('div', { classe: 'evento__corpo' }, [
      criar('span', { classe: ['etiqueta', dadosDoTipo.classe, 'evento__tipo'], texto: dadosDoTipo.rotulo }),
      criar('span', { classe: 'evento__detalhe', texto: detalhe }),
    ]),
  ]);
}
