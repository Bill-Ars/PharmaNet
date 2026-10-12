/*
 * controloFalhas.js — camada de componentes.
 * Controlos do administrador no painel:
 *   controloModoNo()  → cartão de um nó com o controlo segmentado normal / parado / lento
 *   controloGeral()   → algoritmo do balanceador e botão «Repor dados de demonstração»
 * Só desenha; as acções chegam como funções (aoMudarModo, aoMudarAlgoritmo, aoRepor).
 * Usado por paginas/painel.js (só com sessão de admin).
 */
import { $, criar } from '../utilitarios/dom.js';
import { icone } from '../utilitarios/icones.js';

const MODOS = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'parado', rotulo: 'Parado' },
  { valor: 'lento', rotulo: 'Lento' },
];

const ALGORITMOS = [
  { valor: 'round-robin', rotulo: 'Round-robin' },
  { valor: 'menos-ligacoes', rotulo: 'Menos ligações' },
  { valor: 'pesos', rotulo: 'Round-robin com pesos' },
];

/**
 * @param {{no:string, modo:string}} dados
 * @param {{aoMudarModo:(modo:string)=>void}} accoes
 */
export function controloModoNo({ no, modo }, { aoMudarModo }) {
  const opcoes = MODOS.map(({ valor, rotulo }) =>
    criar('label', { classe: 'segmentado__opcao' }, [
      criar('input', {
        type: 'radio',
        name: `modo-${no}`,
        value: valor,
        checked: valor === modo,
        onchange: () => aoMudarModo(valor),
      }),
      rotulo,
    ]),
  );
  return criar('div', { classe: ['cartao', 'falhas__no'], id: `falhas-no-${no}` }, [
    criar('h3', { classe: 'falhas__no-titulo' }, [icone('servidor', { tamanho: 18 }), `Nó ${no}`]),
    criar('fieldset', { classe: 'segmentado' }, [
      criar('legend', { classe: 'visualmente-oculto', texto: `Modo do nó ${no}` }),
      ...opcoes,
    ]),
  ]);
}

/** Marca a opção certa sem voltar a desenhar (ex.: quando um pedido falha e o modo volta atrás). */
export function marcarModo(controlo, modo) {
  const opcao = $(`input[value="${modo}"]`, controlo);
  if (opcao) opcao.checked = true;
}

/**
 * @param {{algoritmo:string}} dados
 * @param {{aoMudarAlgoritmo:(algoritmo:string)=>void, aoRepor:()=>void}} accoes
 */
export function controloGeral({ algoritmo }, { aoMudarAlgoritmo, aoRepor }) {
  const opcoes = ALGORITMOS.map(({ valor, rotulo }) =>
    criar('option', { value: valor, selected: valor === algoritmo, texto: rotulo }),
  );
  return [
    criar('div', { classe: 'campo' }, [
      criar('label', { classe: 'campo__rotulo', for: 'algoritmo', texto: 'Algoritmo do balanceador' }),
      criar('select', {
        classe: 'campo__entrada',
        id: 'algoritmo',
        onchange: (evento) => aoMudarAlgoritmo(evento.target.value),
      }, opcoes),
    ]),
    criar('button', { type: 'button', classe: ['botao', 'botao--perigo'], onclick: aoRepor }, [
      icone('repor'),
      'Repor dados de demonstração',
    ]),
  ];
}
