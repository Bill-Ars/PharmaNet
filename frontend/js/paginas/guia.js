/*
 * guia.js — camada de páginas (ponto de entrada de guia.html).
 * Dá vida ao guia de estilo: monta a navegação, desenha as amostras de cor e liga
 * os botões de demonstração (notificação, modal, cascata, abanão, contagem…).
 * Só para desenvolvimento. Nas fases seguintes passa a usar os componentes de js/componentes/.
 */
import { mostrarNotificacao } from '../componentes/aviso.js';
import { actualizarBotaoTema, navegacao } from '../componentes/navegacao.js';
import { lerSessao, sair } from '../servicos/sessao.js';
import { $, $$, criar, marcarRolagem } from '../utilitarios/dom.js';
import { icone, ilustracao, preencherIcones } from '../utilitarios/icones.js';
import { animarUmaVez, contarAte, entradaEscalonada } from '../utilitarios/animar.js';
import { alternarTema, iniciarTema, temaActual } from '../utilitarios/tema.js';

const TOKENS_DE_COR = [
  '--cor-fundo', '--cor-superficie', '--cor-superficie-2', '--cor-texto', '--cor-texto-suave',
  '--cor-borda', '--cor-primaria', '--cor-primaria-forte', '--cor-primaria-suave',
  '--cor-sucesso', '--cor-sucesso-suave', '--cor-aviso', '--cor-aviso-suave',
  '--cor-erro', '--cor-erro-suave', '--cor-neutra', '--cor-neutra-suave',
];

// Estados possíveis do nó B na demonstração, pela ordem em que o botão os percorre.
const ESTADOS_DO_NO = {
  vivo: { texto: 'Vivo', modo: 'normal', sinal: 'há 1 s', seguinte: 'lento' },
  lento: { texto: 'Lento', modo: 'lento', sinal: 'há 3 s', seguinte: 'indisponivel' },
  indisponivel: { texto: 'Indisponível', modo: 'parado', sinal: 'há 8 s', seguinte: 'vivo' },
};

// Todo o estado da página num só objecto.
const estado = {
  estadoNoB: 'lento',
};

function iniciar() {
  desenharAmostrasDeCor();
  desenharEstadoVazio();
  preencherIcones();
  montarNavegacao();
  ligarDemonstracoes();
}

/* ---------------- Desenho ---------------- */

function desenharAmostrasDeCor() {
  const amostras = TOKENS_DE_COR.map((token) => {
    const cor = criar('span', { classe: 'guia__cor-amostra' });
    cor.style.setProperty('--amostra', `var(${token})`);
    return criar('div', { classe: 'guia__cor' }, [
      cor,
      criar('code', { classe: 'guia__cor-nome', texto: token }),
    ]);
  });
  $('#amostras-cor').append(...amostras);
}

function desenharEstadoVazio() {
  const desenho = ilustracao('pesquisaVazia', { classe: 'estado-vazio__ilustracao' });
  $('#estado-vazio').prepend(desenho);
}

/* ---------------- Navegação ---------------- */

// O guia não aparece no menu, por isso nenhuma ligação fica marcada como actual.
function montarNavegacao() {
  const cabecalho = navegacao({ paginaActual: 'guia', tema: temaActual(), sessao: lerSessao() },
    { aoAlternarTema: alternarTema, aoSair: sair });
  $('#navegacao').replaceWith(cabecalho);
  marcarRolagem(cabecalho);
  iniciarTema();
  document.addEventListener('tema-mudou', (evento) => actualizarBotaoTema(cabecalho, evento.detail.tema));
}

/* ---------------- Demonstrações ---------------- */

function ligarDemonstracoes() {
  // Os formulários do guia são só de exemplo: não enviam nada.
  for (const formulario of $$('#guia-form-pesquisa, #guia-form-campos')) {
    formulario.addEventListener('submit', (evento) => evento.preventDefault());
  }
  $('#botao-carregar').addEventListener('click', simularCarregamento);
  $('#mostrar-palavra').addEventListener('click', alternarPalavraPasse);
  ligarPassos();
  $('#repetir-cascata').addEventListener('click', () => {
    entradaEscalonada($$('#cartoes-farmacia > .cartao'));
  });
  $('#abanar-409').addEventListener('click', () => animarUmaVez($('#aviso-409'), 'anim-abanar'));
  $('#simular-gravacao').addEventListener('click', simularGravacao);
  $('#mostrar-notificacao').addEventListener('click', () => mostrarNotificacao('Gravado.', 'sucesso'));
  $('#mostrar-notificacao-erro').addEventListener('click', () => {
    mostrarNotificacao('Não foi possível gravar. Tente de novo.', 'erro');
  });
  $('#mudar-no').addEventListener('click', avancarEstadoDoNo);
  $('#novos-valores').addEventListener('click', gerarNovosValores);
  ligarModal();
}

function simularCarregamento(evento) {
  const botao = evento.currentTarget;
  botao.setAttribute('aria-busy', 'true');
  setTimeout(() => botao.removeAttribute('aria-busy'), 1500);
}

function alternarPalavraPasse(evento) {
  const botao = evento.currentTarget;
  const campo = $('#guia-palavra');
  const mostrar = campo.type === 'password';
  campo.type = mostrar ? 'text' : 'password';
  botao.setAttribute('aria-pressed', String(mostrar));
  botao.setAttribute('aria-label', mostrar ? 'Esconder palavra-passe' : 'Mostrar palavra-passe');
  botao.replaceChildren(icone(mostrar ? 'olhoFechado' : 'olho'));
}

// Um só ouvinte para todos os campos − / + da página.
function ligarPassos() {
  document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-passo]');
    if (!botao) return;
    const entrada = $('.passos__entrada', botao.closest('[data-passos]'));
    const novoValor = (Number.parseInt(entrada.value, 10) || 0) + Number(botao.dataset.passo);
    entrada.value = String(Math.max(0, novoValor));
  });
}

function simularGravacao() {
  animarUmaVez($('#linha-paracetamol'), 'tabela__linha--gravada');
  mostrarNotificacao('Gravado.', 'sucesso');
}

function avancarEstadoDoNo() {
  estado.estadoNoB = ESTADOS_DO_NO[estado.estadoNoB].seguinte;
  actualizarNo($('#cartao-no-b'), estado.estadoNoB);
}

function actualizarNo(cartao, novoEstado) {
  const dados = ESTADOS_DO_NO[novoEstado];
  cartao.dataset.estado = novoEstado;
  $('[data-campo="estado"]', cartao).textContent = dados.texto;
  $('[data-campo="modo"]', cartao).textContent = dados.modo;
  $('[data-campo="sinal"]', cartao).textContent = dados.sinal;
  animarUmaVez(cartao, 'cartao-no--mudou');
}

function gerarNovosValores() {
  const aleatorio = (maximo) => Math.floor(Math.random() * (maximo + 1));
  contarAte($('#metrica-conflitos'), aleatorio(12));
  contarAte($('#metrica-atraso'), 20 + aleatorio(380));
}

/* ---------------- Modal ---------------- */

function ligarModal() {
  const modal = $('#modal-repor');
  $('#abrir-modal').addEventListener('click', () => modal.showModal());

  // Um clique no fundo escuro (fora da caixa) cai no próprio <dialog>: fecha.
  modal.addEventListener('click', (evento) => {
    if (evento.target === modal) modal.close('cancelar');
  });

  modal.addEventListener('close', () => {
    if (modal.returnValue === 'confirmar') mostrarNotificacao('Dados de demonstração repostos.', 'sucesso');
    modal.returnValue = '';
  });
}

iniciar();
