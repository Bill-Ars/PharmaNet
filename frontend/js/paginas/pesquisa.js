/*
 * pesquisa.js — camada de páginas (ponto de entrada de index.html).
 * Liga o campo de pesquisa e os atalhos, pede a pesquisa ao balanceador (via api.js)
 * e desenha o resultado: esqueletos enquanto espera, depois um cartão por farmácia em cascata.
 * Trata os casos difíceis: sem resposta (Tentar de novo), servidor a arrancar, não encontrado.
 */
import { AVISO_ARRANQUE_MS, LIDER, LIMITE, REPLICA } from '../config/config.js';
import { aviso, estadoVazio } from '../componentes/aviso.js';
import { cartaoFarmacia } from '../componentes/cartaoFarmacia.js';
import { esqueletosDeFarmacias } from '../componentes/esqueleto.js';
import { actualizarBotaoTema, navegacao } from '../componentes/navegacao.js';
import { listarMedicamentos, pesquisar } from '../servicos/api.js';
import { lerSessao, sair } from '../servicos/sessao.js';
import { entradaEscalonada } from '../utilitarios/animar.js';
import { $, $$, criar, limpar, marcarRolagem, substituir } from '../utilitarios/dom.js';
import { formatarDuracao, normalizar } from '../utilitarios/formatar.js';
import { icone, preencherIcones } from '../utilitarios/icones.js';
import { alternarTema, iniciarTema, temaActual } from '../utilitarios/tema.js';

// Todo o estado da página num só objecto.
const estado = {
  numeroDoPedido: 0, // cresce a cada pesquisa; respostas de pesquisas antigas são ignoradas
  primeiroPedido: true, // o primeiro pode apanhar o servidor a acordar
  temporizadorArranque: null,
};

function iniciar() {
  montarNavegacao();
  preencherIcones();
  mostrarEstadoInicial();
  ligarEventos();
  carregarSugestoes();
  pesquisarDoEndereco();
}

function montarNavegacao() {
  const cabecalho = navegacao(
    { paginaActual: 'pesquisa', tema: temaActual(), sessao: lerSessao() },
    { aoAlternarTema: alternarTema, aoSair: sair },
  );
  $('#navegacao').replaceWith(cabecalho);
  marcarRolagem(cabecalho);
  iniciarTema();
  document.addEventListener('tema-mudou', (evento) => actualizarBotaoTema(cabecalho, evento.detail.tema));
}

function ligarEventos() {
  $('#formulario-pesquisa').addEventListener('submit', (evento) => {
    evento.preventDefault();
    executarPesquisa($('#campo-pesquisa').value);
  });
  $('#atalhos').addEventListener('click', (evento) => {
    const atalho = evento.target.closest('[data-pesquisa]');
    if (!atalho) return;
    $('#campo-pesquisa').value = atalho.dataset.pesquisa;
    executarPesquisa(atalho.dataset.pesquisa);
  });
}

// As sugestões do <datalist> são uma ajuda: se o pedido falhar, a página continua igual.
async function carregarSugestoes() {
  const resposta = await listarMedicamentos();
  if (resposta.estado !== 200) return;
  const opcoes = resposta.dados.map((medicamento) => criar('option', { value: medicamento.nome }));
  substituir($('#catalogo'), opcoes);
}

// Permite partilhar uma pesquisa: index.html?q=paracetamol abre já com o resultado.
function pesquisarDoEndereco() {
  const texto = new URLSearchParams(location.search).get('q');
  if (!texto) return;
  $('#campo-pesquisa').value = texto;
  executarPesquisa(texto);
}

/* ---------------- Pesquisa ---------------- */

async function executarPesquisa(textoEscrito) {
  const texto = textoEscrito.trim();
  if (!texto) {
    $('#campo-pesquisa').focus();
    return;
  }
  estado.numeroDoPedido += 1;
  const numeroDestePedido = estado.numeroDoPedido;
  guardarNoEndereco(texto);
  marcarAtalho(texto);
  mostrarCarregamento();

  const limiteMs = estado.primeiroPedido ? LIMITE.arranque : LIMITE.normal;
  const resposta = await pesquisar(texto, { limiteMs });
  // Entretanto a pessoa pode ter feito outra pesquisa: só a mais recente conta.
  if (numeroDestePedido !== estado.numeroDoPedido) return;

  terminarCarregamento();
  mostrarResposta(resposta, texto);
}

function mostrarResposta({ estado: codigo, dados }, texto) {
  if (codigo === 200) desenharResultados(dados);
  else if (codigo === 404) mostrarNaoEncontrado(texto);
  else mostrarErro(texto); // 0 (sem resposta), 503 (nenhum nó vivo) ou outro
}

function mostrarCarregamento() {
  limpar($('#zona-avisos'));
  const lista = $('#lista-resultados');
  substituir(lista, criar('div', { classe: 'grelha-3' }, esqueletosDeFarmacias(3)));
  lista.setAttribute('aria-busy', 'true');
  $('.campo-pesquisa__botao').setAttribute('aria-busy', 'true');
  anunciar('A pesquisar nas três farmácias…');
  if (estado.primeiroPedido) {
    estado.temporizadorArranque = setTimeout(mostrarAvisoArranque, AVISO_ARRANQUE_MS);
  }
}

function terminarCarregamento() {
  clearTimeout(estado.temporizadorArranque);
  estado.primeiroPedido = false;
  limpar($('#zona-avisos'));
  $('#lista-resultados').removeAttribute('aria-busy');
  $('.campo-pesquisa__botao').removeAttribute('aria-busy');
}

/* ---------------- Desenho dos resultados ---------------- */

function desenharResultados({ medicamento, coordenador, tempoMs, farmacias }) {
  const cartoes = farmacias.map((farmacia) =>
    cartaoFarmacia({ farmacia, medicamento, rota: { lider: LIDER[farmacia.id], replica: REPLICA[farmacia.id] } }),
  );
  substituir($('#lista-resultados'), [
    cabecalhoDosResultados(medicamento, farmacias),
    criar('div', { classe: 'grelha-3' }, cartoes),
    resumoDaPesquisa(coordenador, tempoMs),
  ]);
  entradaEscalonada(cartoes);
  anunciar(frasesDaContagem(farmacias).filter(Boolean).join('. '));
}

function cabecalhoDosResultados(medicamento, farmacias) {
  const [principal, extra] = frasesDaContagem(farmacias);
  return criar('div', { classe: 'resultados__cabecalho' }, [
    criar('div', {}, [
      criar('p', { classe: 'sobretitulo', texto: 'Resultado da pesquisa' }),
      criar('h2', { classe: 'resultados__titulo' }, [
        `${medicamento.nome} `,
        criar('span', { classe: 'resultados__detalhe', texto: `${medicamento.dosagem} · ${medicamento.apresentacao}` }),
      ]),
    ]),
    criar('p', { classe: 'resultados__contagem' }, [principal, extra && ` · ${extra}`]),
  ]);
}

// «Disponível em 2 de 3 farmácias» e, se for o caso, «1 sem resposta».
function frasesDaContagem(farmacias) {
  const disponiveis = farmacias.filter((farmacia) => farmacia.disponivel === true).length;
  const semResposta = farmacias.filter((farmacia) => farmacia.origem === 'indisponivel').length;
  const principal = `Disponível em ${disponiveis} de ${farmacias.length} farmácias`;
  return [principal, semResposta > 0 ? `${semResposta} sem resposta` : null];
}

function resumoDaPesquisa(coordenador, tempoMs) {
  return criar('p', { classe: 'resultados__resumo' }, [
    icone('servidor', { tamanho: 16 }),
    `Coordenado pelo nó ${coordenador}`,
    criar('span', { classe: 'resultados__separador', 'aria-hidden': 'true', texto: '·' }),
    icone('relogio', { tamanho: 16 }),
    formatarDuracao(tempoMs),
  ]);
}

/* ---------------- Estados especiais ---------------- */

function mostrarEstadoInicial() {
  substituir(
    $('#lista-resultados'),
    estadoVazio({
      titulo: 'Ainda não pesquisou nada',
      texto: 'Escreva o nome de um medicamento para ver onde está disponível.',
    }),
  );
}

function mostrarNaoEncontrado(texto) {
  substituir(
    $('#lista-resultados'),
    estadoVazio({
      titulo: `Não encontrámos «${texto}»`,
      texto: 'Verifique o nome ou escolha uma das sugestões que aparecem ao escrever.',
    }),
  );
  anunciar(`Não encontrámos ${texto}.`);
}

function mostrarErro(texto) {
  limpar($('#lista-resultados'));
  const caixa = aviso(
    { tipo: 'erro', icone: 'semLigacao', titulo: 'Não foi possível pesquisar agora. Tente de novo.' },
    { accao: { rotulo: 'Tentar de novo', icone: 'recarregar', aoClicar: () => executarPesquisa(texto) } },
  );
  substituir($('#zona-avisos'), caixa);
  anunciar('Não foi possível pesquisar agora. Tente de novo.');
}

function mostrarAvisoArranque() {
  substituir(
    $('#zona-avisos'),
    aviso({ tipo: 'aviso', icone: 'relogio', titulo: 'O servidor pode estar a arrancar; pode demorar até 1 minuto.' }),
  );
}

/* ---------------- Pequenas ajudas ---------------- */

function anunciar(frase) {
  $('#anuncio').textContent = frase;
}

function guardarNoEndereco(texto) {
  history.replaceState(null, '', `?q=${encodeURIComponent(texto)}`);
}

// O atalho igual ao texto pesquisado fica marcado (aria-pressed).
function marcarAtalho(texto) {
  for (const atalho of $$('[data-pesquisa]')) {
    atalho.setAttribute('aria-pressed', String(normalizar(atalho.dataset.pesquisa) === normalizar(texto)));
  }
}

iniciar();
