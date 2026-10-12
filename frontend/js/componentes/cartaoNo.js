/*
 * cartaoNo.js — camada de componentes.
 * Cartão de um nó (A, B ou C) no painel: estado (vivo, lento, indisponível) com o ponto
 * a pulsar, modo, farmácia de que é líder e de que guarda réplica, e «último sinal há X s».
 * cartaoNo() desenha o cartão uma vez; actualizarCartaoNo() muda só os valores, para
 * o ponto continuar a pulsar sem saltos. Usado por paginas/painel.js.
 */
import { $, criar } from '../utilitarios/dom.js';
import { haQuanto } from '../utilitarios/formatar.js';

const TEXTO_DO_ESTADO = { vivo: 'Vivo', lento: 'Lento', indisponivel: 'Indisponível' };

/**
 * @param {object} dados
 * @param {string} dados.no              'A', 'B' ou 'C'
 * @param {number} dados.lider           farmácia de que é líder
 * @param {number} dados.replica         farmácia de que guarda a réplica
 * @param {'vivo'|'lento'|'indisponivel'} dados.estado
 * @param {string|null} dados.modo       'normal', 'lento'… (null se ainda não se sabe)
 * @param {number|null} dados.segundosDesdeSinal  null se nunca respondeu
 * @returns {HTMLElement}
 */
export function cartaoNo(dados) {
  const idNome = `nome-no-${dados.no}`;
  const cartao = criar('article', { classe: ['cartao', 'cartao-no'], 'aria-labelledby': idNome, dados: { no: dados.no } }, [
    criar('header', { classe: 'cartao-no__cabecalho' }, [
      criar('div', { classe: 'cartao-no__identidade' }, [
        criar('span', { classe: 'cartao-no__monograma', 'aria-hidden': 'true', texto: dados.no }),
        criar('div', {}, [
          criar('p', { classe: 'cartao-no__sobretitulo', texto: 'Nó' }),
          criar('h3', { classe: 'cartao-no__nome', id: idNome, texto: `Nó ${dados.no}` }),
        ]),
      ]),
      criar('span', { classe: 'cartao-no__estado' }, [
        criar('span', { classe: 'ponto-estado' }),
        criar('span', { dados: { campo: 'estado' } }),
      ]),
    ]),
    criar('dl', { classe: 'cartao-no__dados' }, [
      par('Modo', criar('dd', { dados: { campo: 'modo' } })),
      par('Último sinal', criar('dd', { dados: { campo: 'sinal' } })),
      par('Líder de', criar('dd', { texto: `Farmácia ${dados.lider}` })),
      par('Réplica de', criar('dd', { texto: `Farmácia ${dados.replica}` })),
    ]),
  ]);
  actualizarCartaoNo(cartao, dados);
  return cartao;
}

/** Muda só o que pode mudar (estado, modo, último sinal). */
export function actualizarCartaoNo(cartao, { estado, modo, segundosDesdeSinal }) {
  cartao.dataset.estado = estado;
  $('[data-campo="estado"]', cartao).textContent = TEXTO_DO_ESTADO[estado];
  $('[data-campo="modo"]', cartao).textContent = modo ?? '—';
  $('[data-campo="sinal"]', cartao).textContent = segundosDesdeSinal === null ? 'sem sinal' : haQuanto(segundosDesdeSinal);
}

function par(rotulo, valor) {
  return criar('div', {}, [criar('dt', { texto: rotulo }), valor]);
}
