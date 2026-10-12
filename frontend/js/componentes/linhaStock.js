/*
 * linhaStock.js — camada de componentes.
 * Uma linha da tabela de stock: nome, quantidade, versão e acções.
 * Em edição, a quantidade passa a um campo com − e + e aparecem «Gravar» e «Cancelar».
 * Usado por paginas/gestao.js, que guarda o estado e volta a desenhar só a linha afectada.
 */
import { criar } from '../utilitarios/dom.js';
import { icone } from '../utilitarios/icones.js';

/**
 * @param {{medicamentoId:number, nome:string, quantidade:number, versao:number}} item
 * @param {object} opcoes  aEditar, aGravar, soLeitura (booleanos), erro (texto ou null)
 *                         e valor (o que a pessoa escreveu, para não se perder ao redesenhar)
 * @param {object} accoes  aoEditar(), aoCancelar(), aoGravar(textoDaQuantidade)
 * @returns {HTMLTableRowElement}
 */
export function linhaStock(item, { aEditar = false, aGravar = false, soLeitura = false, erro = null, valor = null } = {}, accoes) {
  const campo = aEditar ? campoQuantidade(item, valor ?? String(item.quantidade), erro, accoes) : null;
  return criar('tr', { classe: ['tabela__linha', aEditar && 'tabela__linha--a-editar'], dados: { medicamento: item.medicamentoId } }, [
    criar('td', { classe: 'tabela__nome', texto: item.nome }),
    criar('td', { classe: 'tabela__numero', 'data-rotulo': 'Quantidade' }, campo?.elemento ?? quantidade(item)),
    criar('td', { 'data-rotulo': 'Versão' }, criar('span', { classe: ['etiqueta', 'etiqueta--contorno'], texto: `v${item.versao}` })),
    criar('td', { classe: 'tabela__accoes' }, [
      criar('div', { classe: 'tabela__accoes-grupo' },
        aEditar ? botoesDeEdicao(item, aGravar, soLeitura, () => campo.entrada.value, accoes) : botaoEditar(item, soLeitura, accoes)),
    ]),
  ]);
}

function quantidade(item) {
  return criar('span', {
    classe: ['tabela__quantidade', item.quantidade === 0 && 'tabela__quantidade--zero'],
    texto: String(item.quantidade),
  });
}

function botaoEditar(item, soLeitura, { aoEditar }) {
  return criar('button', {
    type: 'button',
    classe: ['botao', 'botao--secundario', 'botao--pequeno'],
    'aria-label': `Editar ${item.nome}`,
    disabled: soLeitura,
    onclick: aoEditar,
  }, [icone('editar', { tamanho: 16 }), 'Editar']);
}

function botoesDeEdicao(item, aGravar, soLeitura, lerValor, { aoGravar, aoCancelar }) {
  return [
    criar('button', {
      type: 'button',
      classe: ['botao', 'botao--pequeno'],
      'aria-busy': aGravar ? 'true' : null,
      disabled: soLeitura,
      onclick: () => aoGravar(lerValor()),
    }, [icone('certo', { tamanho: 16 }), 'Gravar']),
    criar('button', { type: 'button', classe: ['botao', 'botao--secundario', 'botao--pequeno'], onclick: aoCancelar }, 'Cancelar'),
  ];
}

/* ---------------- Campo da quantidade (− número +) ---------------- */

function campoQuantidade(item, valor, erro, { aoGravar, aoCancelar }) {
  const idErro = `erro-quantidade-${item.medicamentoId}`;
  const entrada = criar('input', {
    classe: 'passos__entrada',
    id: `quantidade-${item.medicamentoId}`,
    type: 'number',
    inputmode: 'numeric',
    min: '0',
    step: '1',
    value: valor,
    'aria-label': `Quantidade de ${item.nome}`,
    'aria-invalid': erro ? 'true' : null,
    'aria-describedby': erro ? idErro : null,
    // Enter grava, Esc cancela: tudo se faz sem largar o teclado.
    onkeydown: (evento) => {
      if (evento.key === 'Enter') aoGravar(entrada.value);
      if (evento.key === 'Escape') aoCancelar();
    },
  });

  const elemento = criar('div', { classe: 'campo-quantidade' }, [
    criar('div', { classe: 'passos' }, [
      botaoPasso(-1, item.nome, entrada),
      entrada,
      botaoPasso(1, item.nome, entrada),
    ]),
    erro && criar('p', { classe: 'campo__erro', id: idErro }, [icone('circuloX', { tamanho: 16 }), erro]),
  ]);
  return { elemento, entrada };
}

// Os botões − e + só mexem no número do próprio campo (nunca abaixo de 0).
function botaoPasso(passo, nome, entrada) {
  return criar('button', {
    type: 'button',
    classe: 'passos__botao',
    'aria-label': `${passo > 0 ? 'Aumentar' : 'Diminuir'} quantidade de ${nome}`,
    onclick: () => {
      const actual = Number.parseInt(entrada.value, 10) || 0;
      entrada.value = String(Math.max(0, actual + passo));
    },
  }, icone(passo > 0 ? 'mais' : 'menos'));
}
