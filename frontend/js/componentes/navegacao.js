/*
 * navegacao.js — camada de componentes.
 * Desenha o cabeçalho do site: marca, menu das quatro páginas e botão de tema.
 * Com sessão iniciada, «Entrar» dá lugar a «Sair» (e o nome do utilizador no topo).
 * No telemóvel o mesmo menu passa (só por CSS) a barra inferior fixa.
 * Usado por todas as páginas, que o põem no lugar de <div id="navegacao">.
 */
import { $, criar } from '../utilitarios/dom.js';
import { icone } from '../utilitarios/icones.js';

const PAGINAS = [
  { id: 'pesquisa', rotulo: 'Pesquisa', endereco: 'index.html', icone: 'pesquisa' },
  { id: 'gestao', rotulo: 'Gestão', endereco: 'gestao.html', icone: 'caixa' },
  { id: 'painel', rotulo: 'Painel', endereco: 'painel.html', icone: 'actividade' },
];

const ENTRAR = { id: 'login', rotulo: 'Entrar', endereco: 'login.html', icone: 'entrar' };

/**
 * @param {object} dados
 * @param {string} dados.paginaActual  'pesquisa' | 'gestao' | 'painel' | 'login' (ou outro, sem destaque)
 * @param {'claro'|'escuro'} dados.tema  tema aplicado agora
 * @param {{utilizador:string, papel:string}|null} dados.sessao  sessão iniciada, se houver
 * @param {object} accoes
 * @param {() => void} accoes.aoAlternarTema  chamado ao carregar no botão sol/lua
 * @param {() => void} accoes.aoSair  chamado ao carregar em «Sair»
 * @returns {HTMLElement} o <header> completo
 */
export function navegacao({ paginaActual, tema, sessao = null }, { aoAlternarTema, aoSair }) {
  return criar('header', { classe: 'cabecalho' }, [
    criar('div', { classe: ['contentor', 'cabecalho__interior'] }, [
      marca(),
      menu(paginaActual, sessao, aoSair),
      sessao && identificacao(sessao),
      botaoTema(tema, aoAlternarTema),
    ]),
  ]);
}

/** Volta a desenhar só o botão de tema (quando o tema muda). */
export function actualizarBotaoTema(cabecalho, tema) {
  desenharBotaoTema($('.cabecalho__tema', cabecalho), tema);
}

// O ícone mostra o tema para onde se vai: lua no modo claro, sol no escuro.
function desenharBotaoTema(botao, tema) {
  const escuro = tema === 'escuro';
  botao.replaceChildren(icone(escuro ? 'sol' : 'lua'));
  botao.setAttribute('aria-label', escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro');
}

function marca() {
  return criar('a', { classe: 'marca', href: 'index.html', 'aria-label': 'FarmaRede — página inicial' }, [
    criar('span', { classe: 'marca__simbolo' }, icone('cruz')),
    criar('span', {}, ['Farma', criar('span', { classe: 'marca__realce', texto: 'Rede' })]),
  ]);
}

function menu(paginaActual, sessao, aoSair) {
  const itens = PAGINAS.map((pagina) => ligacaoDoMenu(pagina, pagina.id === paginaActual));
  itens.push(sessao ? botaoSair(sessao, aoSair) : ligacaoDoMenu(ENTRAR, paginaActual === ENTRAR.id));
  return criar('nav', { classe: 'menu', 'aria-label': 'Principal' }, [
    criar('ul', { classe: 'menu__lista', role: 'list' }, itens.map((item) => criar('li', {}, item))),
  ]);
}

function ligacaoDoMenu(pagina, actual) {
  return criar(
    'a',
    {
      classe: 'menu__ligacao',
      href: pagina.endereco,
      // aria-current diz ao leitor de ecrã (e ao CSS) qual é a página aberta.
      'aria-current': actual ? 'page' : null,
    },
    conteudoDoItem(pagina.icone, pagina.rotulo),
  );
}

function botaoSair(sessao, aoSair) {
  return criar(
    'button',
    { type: 'button', classe: 'menu__ligacao', 'aria-label': `Sair da sessão de ${sessao.utilizador}`, onclick: aoSair },
    conteudoDoItem('sair', 'Sair'),
  );
}

function conteudoDoItem(nomeIcone, rotulo) {
  return [
    criar('span', { classe: 'menu__icone' }, icone(nomeIcone, { tamanho: 20 })),
    criar('span', { classe: 'menu__rotulo', texto: rotulo }),
  ];
}

// Quem está com sessão iniciada (só a partir do tablet; no telemóvel não há espaço).
function identificacao({ utilizador, papel }) {
  return criar('span', { classe: 'cabecalho__utilizador', title: papel === 'admin' ? 'Administrador' : 'Operador' }, [
    icone(papel === 'admin' ? 'cadeado' : 'utilizador', { tamanho: 16 }),
    utilizador,
  ]);
}

function botaoTema(tema, aoAlternarTema) {
  const botao = criar('button', {
    type: 'button',
    classe: ['botao', 'botao--secundario', 'botao--icone', 'cabecalho__tema'],
    onclick: aoAlternarTema,
  });
  desenharBotaoTema(botao, tema);
  return botao;
}
