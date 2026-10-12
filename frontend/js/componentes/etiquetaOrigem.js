/*
 * etiquetaOrigem.js — camada de componentes.
 * Etiqueta que diz de onde veio um dado: «líder» (verde), «réplica — pode estar
 * desactualizado» (âmbar) ou «sem resposta» (cinzento). Cor sempre com ícone e texto.
 * Usado por cartaoFarmacia.js (e mais tarde pela gestão de stock).
 */
import { criar } from '../utilitarios/dom.js';
import { icone } from '../utilitarios/icones.js';

const ORIGENS = {
  lider: { texto: 'líder', icone: 'coroa', classe: 'etiqueta--lider' },
  replica: { texto: 'réplica — pode estar desactualizado', icone: 'copia', classe: 'etiqueta--replica' },
  indisponivel: { texto: 'sem resposta', icone: 'semLigacao', classe: 'etiqueta--indisponivel' },
};

/**
 * @param {'lider'|'replica'|'indisponivel'} origem
 * @returns {HTMLElement}
 */
export function etiquetaOrigem(origem) {
  const dados = ORIGENS[origem] ?? ORIGENS.indisponivel;
  return criar('span', { classe: ['etiqueta', dados.classe] }, [
    icone(dados.icone, { tamanho: 14 }),
    dados.texto,
  ]);
}
