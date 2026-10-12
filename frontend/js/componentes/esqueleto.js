/*
 * esqueleto.js — camada de componentes.
 * Blocos de carregamento com a forma do conteúdo que vai chegar,
 * para a página não ficar em branco nem «saltar» quando chega a resposta.
 * Usado por paginas/pesquisa.js (e mais tarde pela gestão e pelo painel).
 */
import { criar } from '../utilitarios/dom.js';

function bloco(...variantes) {
  return criar('span', { classe: ['esqueleto', ...variantes.map((v) => `esqueleto--${v}`)] });
}

/** Um cartão de farmácia «a carregar», com as mesmas medidas do verdadeiro. */
export function esqueletoCartaoFarmacia() {
  return criar('article', { classe: ['cartao', 'cartao-farmacia', 'cartao-farmacia--esqueleto'] }, [
    criar('span', { classe: 'visualmente-oculto', texto: 'A consultar a farmácia…' }),
    criar('div', { classe: 'cartao-farmacia__cabecalho', 'aria-hidden': 'true' }, [
      criar('div', { classe: 'pilha' }, [bloco('texto', 'rotulo'), bloco('titulo')]),
      bloco('quadrado'),
    ]),
    criar('div', { 'aria-hidden': 'true' }, bloco('titulo')),
    criar('div', { classe: 'cartao-farmacia__rodape', 'aria-hidden': 'true' }, [bloco('rota'), bloco('etiqueta')]),
  ]);
}

/** Uma linha da tabela de stock «a carregar». */
export function esqueletoLinhaStock() {
  return criar('tr', { classe: 'tabela__linha', 'aria-hidden': 'true' }, [
    criar('td', { classe: 'tabela__nome' }, bloco('texto', 'medio')),
    criar('td', { classe: 'tabela__numero' }, bloco('texto')),
    criar('td', {}, bloco('texto', 'curto')),
    criar('td', { classe: 'tabela__accoes' }, bloco('etiqueta')),
  ]);
}

/** Vários cartões «a carregar» (um por farmácia). */
export function esqueletosDeFarmacias(quantidade = 3) {
  return Array.from({ length: quantidade }, esqueletoCartaoFarmacia);
}
