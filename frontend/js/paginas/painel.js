/*
 * painel.js — camada de páginas (ponto de entrada de painel.html).
 * Sondagem em tempo real: de 2 em 2 s pede as métricas e os eventos aos três nós
 * EM PARALELO (Promise.all). Um nó que não responde não atrasa nem afecta os outros.
 * Estado de cada nó: vivo / lento / indisponível (sem sinal há 6 s).
 * A sondagem pára quando o separador fica escondido e retoma quando volta.
 * Com os dados de cada volta actualiza os gráficos, os números grandes e «Mais pesquisados».
 * Com sessão de admin mostra também o controlo de falhas (modos, algoritmo, repor dados).
 */
import { LIDER, NOS, PAINEL, REPLICA } from '../config/config.js';
import { mostrarNotificacao } from '../componentes/aviso.js';
import { actualizarCartaoNo, cartaoNo } from '../componentes/cartaoNo.js';
import { controloGeral, controloModoNo, marcarModo } from '../componentes/controloFalhas.js';
import { graficoLatencia } from '../componentes/graficoLatencia.js';
import { graficoPedidos } from '../componentes/graficoPedidos.js';
import { listaEventos } from '../componentes/listaEventos.js';
import { modalConfirmar } from '../componentes/modalConfirmar.js';
import { actualizarBotaoTema, navegacao } from '../componentes/navegacao.js';
import { lerEventos, lerMetricas, mudarAlgoritmo, mudarModo, reporDados } from '../servicos/api.js';
import { irParaLogin, lerSessao, sair, terminarSessao } from '../servicos/sessao.js';
import { animarUmaVez, contarAte } from '../utilitarios/animar.js';
import { $, criar, marcarRolagem, substituir } from '../utilitarios/dom.js';
import { preencherIcones } from '../utilitarios/icones.js';
import { alternarTema, iniciarTema, temaActual } from '../utilitarios/tema.js';

const TEXTO_DO_ESTADO = { vivo: 'está vivo', lento: 'está lento', indisponivel: 'ficou indisponível' };

// Todo o estado da página num só objecto.
const estado = {
  sessao: null,
  nos: Object.fromEntries(NOS.map((no) => [no, { estado: null, modo: null, ultimaResposta: null, tempoMs: null, janela: null }])),
  graficos: { pedidos: null, latencia: null },
  latencia: [], // últimas 12 janelas { hora, medianaMs, p95Ms }
  ultimoPontoEm: 0,
  assinaturaPesquisados: '', // para só redesenhar a lista quando muda
  // Controlo de falhas (admin): o último modo pedido de cada nó e os pedidos em curso.
  modosPedidos: Object.fromEntries(NOS.map((no) => [no, 'normal'])),
  aMudarModo: Object.fromEntries(NOS.map((no) => [no, false])),
  algoritmo: 'round-robin',
  cartoes: {}, // elemento de cada nó, desenhado uma vez
  eventos: [], // mostrados, do mais recente para o mais antigo (no máximo 20)
  ultimoEvento: Object.fromEntries(NOS.map((no) => [no, 0])), // para pedir só os novos
  numeroEventoLocal: 0,
  listaDesenhada: false,
  temporizadorSondagem: null,
  temporizadorRelogio: null,
  activo: false, // false com o separador escondido
  ciclo: 0, // muda a cada retoma: uma sondagem de um ciclo antigo não agenda a seguinte
};

function iniciar() {
  estado.sessao = lerSessao();
  montarNavegacao();
  preencherIcones();
  criarGraficos();
  if (estado.sessao?.papel === 'admin') desenharControloDeFalhas();
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  retomar();
}

function montarNavegacao() {
  const cabecalho = navegacao(
    { paginaActual: 'painel', tema: temaActual(), sessao: estado.sessao },
    { aoAlternarTema: alternarTema, aoSair: sair },
  );
  $('#navegacao').replaceWith(cabecalho);
  marcarRolagem(cabecalho);
  iniciarTema();
  document.addEventListener('tema-mudou', (evento) => actualizarBotaoTema(cabecalho, evento.detail.tema));
}

/* ======================================================================
   Ciclo de sondagem
   ====================================================================== */

function retomar() {
  if (estado.activo) return;
  estado.activo = true;
  estado.ciclo += 1;
  mostrarEstadoDaSondagem();
  sondar(estado.ciclo);
  // O relógio reavalia os nós a cada segundo: «há X s» sobe e o «indisponível» aparece a tempo.
  estado.temporizadorRelogio = setInterval(reavaliarTodos, 1000);
}

function pausar() {
  estado.activo = false;
  clearTimeout(estado.temporizadorSondagem);
  clearInterval(estado.temporizadorRelogio);
  mostrarEstadoDaSondagem();
}

function aoMudarVisibilidade() {
  if (document.hidden) pausar();
  else retomar();
}

async function sondar(ciclo) {
  const inicio = performance.now();
  // Os três nós ao mesmo tempo; cada pedido devolve sempre { estado, dados } (nunca falha).
  const resultados = await Promise.all(NOS.map(sondarNo));
  if (!estado.activo || ciclo !== estado.ciclo) return; // o separador foi escondido entretanto

  resultados.forEach(registarResultado);
  reavaliarTodos();
  if (!estado.listaDesenhada) desenharListaEventos();
  actualizarResumo();
  // Próxima volta 2 s depois do início desta (um nó lento não a empurra para mais tarde).
  const espera = Math.max(0, PAINEL.intervaloMs - (performance.now() - inicio));
  estado.temporizadorSondagem = setTimeout(() => sondar(ciclo), espera);
}

async function sondarNo(no) {
  // O nó estava vivo quando recebeu o pedido: é essa a hora do «último sinal».
  const enviadoEm = Date.now();
  const inicio = performance.now();
  const [metricas, eventos] = await Promise.all([lerMetricas(no), lerEventos(no, estado.ultimoEvento[no])]);
  return { no, metricas, eventos, enviadoEm, tempoMs: performance.now() - inicio };
}

function registarResultado({ no, metricas, eventos, enviadoEm, tempoMs }) {
  if (metricas.estado === 200) {
    const { modo, janela } = metricas.dados;
    Object.assign(estado.nos[no], { modo, janela, ultimaResposta: enviadoEm, tempoMs });
    sincronizarModo(no, modo);
  }
  if (eventos.estado === 200 && eventos.dados.eventos.length) {
    estado.ultimoEvento[no] = Math.max(...eventos.dados.eventos.map((evento) => evento.id));
    acrescentarEventos(eventos.dados.eventos);
  }
}

/* ======================================================================
   Estado dos nós
   ====================================================================== */

function calcularEstado(no) {
  const info = estado.nos[no];
  if (!info.ultimaResposta || Date.now() - info.ultimaResposta >= PAINEL.semSinalMs) return 'indisponivel';
  if (info.modo === 'lento' || info.tempoMs > PAINEL.lentoMs) return 'lento';
  return 'vivo';
}

function reavaliarTodos() {
  if (Object.keys(estado.cartoes).length === 0) desenharCartoes();
  NOS.forEach(actualizarNo);
}

function desenharCartoes() {
  for (const no of NOS) estado.cartoes[no] = cartaoNo({ no, ...dadosDoCartao(no) });
  const contentor = $('#cartoes-nos');
  contentor.removeAttribute('aria-busy');
  substituir(contentor, NOS.map((no) => estado.cartoes[no]));
}

function actualizarNo(no) {
  const novoEstado = calcularEstado(no);
  const anterior = estado.nos[no].estado;
  estado.nos[no].estado = novoEstado;
  actualizarCartaoNo(estado.cartoes[no], dadosDoCartao(no));

  // Na primeira volta não há «mudança», só o estado inicial.
  if (anterior !== null && anterior !== novoEstado) {
    animarUmaVez(estado.cartoes[no], 'cartao-no--mudou');
    registarMudancaDeEstado(no, novoEstado);
  }
}

function dadosDoCartao(no) {
  const info = estado.nos[no];
  return {
    lider: farmaciaDe(LIDER, no),
    replica: farmaciaDe(REPLICA, no),
    estado: info.estado ?? calcularEstado(no),
    modo: info.modo,
    segundosDesdeSinal: info.ultimaResposta ? (Date.now() - info.ultimaResposta) / 1000 : null,
  };
}

function farmaciaDe(mapa, no) {
  return Number(Object.keys(mapa).find((farmacia) => mapa[farmacia] === no));
}

// Um nó parado não consegue contar que parou: é o painel que regista a mudança.
function registarMudancaDeEstado(no, novoEstado) {
  estado.numeroEventoLocal += 1;
  acrescentarEventos([{
    id: `local-${estado.numeroEventoLocal}`,
    hora: new Date().toISOString(),
    no,
    tipo: novoEstado,
    detalhe: `Nó ${no} ${TEXTO_DO_ESTADO[novoEstado]}`,
  }]);
  $('#anuncio').textContent = `Nó ${no} ${TEXTO_DO_ESTADO[novoEstado]}.`;
}

/* ======================================================================
   Últimos eventos
   ====================================================================== */

// Os eventos de um nó que esteve parado só chegam quando ele volta (com horas antigas),
// por isso a lista é sempre reordenada pela hora, do mais recente para o mais antigo.
function acrescentarEventos(novos) {
  estado.eventos = [...novos, ...estado.eventos]
    .sort((a, b) => Date.parse(b.hora) - Date.parse(a.hora))
    .slice(0, PAINEL.maxEventos);
  desenharListaEventos(new Set(novos.map((evento) => evento.id)));
}

/** Desenha a lista (ou a frase de lista vazia). Só os eventos novos entram a desvanecer. */
function desenharListaEventos(idsNovos = new Set()) {
  const zona = $('#lista-eventos');
  zona.removeAttribute('aria-hidden');
  estado.listaDesenhada = true;
  if (estado.eventos.length === 0) {
    substituir(zona, criar('p', { classe: 'painel__eventos-vazio', texto: 'Ainda não há eventos. Pesquise ou grave stock para os ver aparecer.' }));
    return;
  }
  const lista = listaEventos(estado.eventos);
  estado.eventos.forEach((evento, posicao) => {
    if (idsNovos.has(evento.id)) lista.children[posicao].classList.add('anim-aparecer');
  });
  substituir(zona, lista);
}

/* ======================================================================
   Gráficos, números grandes e «Mais pesquisados»
   ====================================================================== */

function criarGraficos() {
  estado.graficos.pedidos = graficoPedidos();
  estado.graficos.latencia = graficoLatencia();
  substituir($('#grafico-pedidos'), estado.graficos.pedidos.elemento);
  substituir($('#grafico-latencia'), estado.graficos.latencia.elemento);
  // As cores dos gráficos vêm dos tokens: ao mudar de tema voltam a ser lidas.
  document.addEventListener('tema-mudou', () => {
    estado.graficos.pedidos.mudarTema();
    estado.graficos.latencia.mudarTema();
  });
}

/** Junta as janelas dos nós que estão a responder e actualiza tudo o que delas depende. */
function actualizarResumo() {
  const comDados = NOS.filter((no) => estado.nos[no].estado !== 'indisponivel' && estado.nos[no].janela);
  const janelas = comDados.map((no) => estado.nos[no].janela);
  estado.graficos.pedidos.actualizar(NOS.map((no) => ({
    no,
    estado: estado.nos[no].estado,
    pedidos: comDados.includes(no) ? estado.nos[no].janela.pedidos : 0,
  })));
  if (janelas.length === 0) return;
  registarPontoDeLatencia(janelas);
  actualizarNumeros(janelas);
  desenharMaisPesquisados(janelas);
}

// Um ponto novo a cada janela de 5 s; ficam os últimos 12 (1 minuto).
function registarPontoDeLatencia(janelas) {
  if (Date.now() - estado.ultimoPontoEm < PAINEL.janelaMs) return;
  estado.ultimoPontoEm = Date.now();
  const mediana = Math.round(janelas.reduce((soma, janela) => soma + janela.medianaMs, 0) / janelas.length);
  const p95 = Math.max(...janelas.map((janela) => janela.p95Ms));
  estado.latencia = [...estado.latencia, { hora: Date.now(), medianaMs: mediana, p95Ms: p95 }].slice(-PAINEL.pontosLatencia);
  estado.graficos.latencia.actualizar(estado.latencia);
}

function actualizarNumeros(janelas) {
  const conflitos = janelas.reduce((soma, janela) => soma + janela.conflitos409, 0);
  const atraso = Math.max(...janelas.map((janela) => janela.atrasoReplicaMs));
  contarAte($('#metrica-conflitos'), conflitos);
  contarAte($('#metrica-atraso'), atraso);
}

// Cada nó conta as pesquisas que coordenou: somam-se as três listas.
function desenharMaisPesquisados(janelas) {
  const totais = {};
  for (const { nome, total } of janelas.flatMap((janela) => janela.maisPesquisados)) {
    totais[nome] = (totais[nome] ?? 0) + total;
  }
  const lista = Object.entries(totais)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, PAINEL.maisPesquisados);

  const assinatura = JSON.stringify(lista);
  if (assinatura === estado.assinaturaPesquisados) return; // nada mudou: não redesenhar
  estado.assinaturaPesquisados = assinatura;

  const zona = $('#lista-pesquisados');
  zona.removeAttribute('aria-hidden');
  if (lista.length === 0) {
    substituir(zona, criar('p', { classe: 'painel__vazio', texto: 'Ainda ninguém pesquisou. Faça uma pesquisa para a ver aqui.' }));
    return;
  }
  substituir(zona, criar('ol', { classe: 'ranking', role: 'list' }, lista.map((item) => itemDoRanking(item, lista[0].total))));
}

function itemDoRanking({ nome, total }, maximo) {
  const barra = criar('span', { classe: 'ranking__barra' });
  barra.style.setProperty('--proporcao', String(total / maximo));
  return criar('li', { classe: 'ranking__item' }, [
    criar('span', { classe: 'ranking__nome', texto: nome }),
    criar('span', { classe: 'ranking__total', texto: `${total} ${total === 1 ? 'pesquisa' : 'pesquisas'}` }),
    criar('span', { classe: 'ranking__pista', 'aria-hidden': 'true' }, barra),
  ]);
}

/* ======================================================================
   Controlo de falhas (só admin)
   ====================================================================== */

function desenharControloDeFalhas() {
  $('#controlo-falhas').hidden = false;
  substituir($('#falhas-nos'), NOS.map((no) =>
    controloModoNo({ no, modo: estado.modosPedidos[no] }, { aoMudarModo: (modo) => pedirModo(no, modo) }),
  ));
  substituir($('#falhas-geral'), controloGeral(
    { algoritmo: estado.algoritmo },
    { aoMudarAlgoritmo: pedirAlgoritmo, aoRepor: pedirReposicao },
  ));
}

// Quando o nó responde, o controlo mostra o modo verdadeiro (ex.: mudado na consola).
function sincronizarModo(no, modo) {
  if (estado.sessao?.papel !== 'admin' || estado.aMudarModo[no] || estado.modosPedidos[no] === modo) return;
  estado.modosPedidos[no] = modo;
  marcarModo($(`#falhas-no-${no}`), modo);
}

async function pedirModo(no, modo) {
  estado.aMudarModo[no] = true;
  const { estado: codigo } = await mudarModo(no, modo, estado.sessao.token);
  estado.aMudarModo[no] = false;
  if (codigo === 200) {
    estado.modosPedidos[no] = modo;
    mostrarNotificacao(`Nó ${no} passou a «${modo}».`, 'sucesso');
    return;
  }
  marcarModo($(`#falhas-no-${no}`), estado.modosPedidos[no]); // volta à opção anterior
  tratarErroDeAdministracao(codigo, `Não foi possível mudar o modo do nó ${no}.`);
}

async function pedirAlgoritmo(algoritmo) {
  const { estado: codigo } = await mudarAlgoritmo(algoritmo, estado.sessao.token);
  if (codigo === 200) {
    estado.algoritmo = algoritmo;
    mostrarNotificacao('Algoritmo do balanceador alterado.', 'sucesso');
    return;
  }
  $('#algoritmo').value = estado.algoritmo;
  tratarErroDeAdministracao(codigo, 'Não foi possível mudar o algoritmo.');
}

async function pedirReposicao() {
  const confirmou = await modalConfirmar({
    titulo: 'Repor dados de demonstração?',
    texto: 'O stock das três farmácias volta aos valores iniciais e os nós voltam ao modo normal. Não é possível desfazer.',
    rotuloConfirmar: 'Repor dados',
    icone: 'repor',
  });
  if (!confirmou) return;

  const respostas = await reporDados(estado.sessao.token);
  if (respostas.some((resposta) => resposta.estado === 401)) {
    tratarErroDeAdministracao(401);
    return;
  }
  const certos = respostas.filter((resposta) => resposta.estado === 200).length;
  if (certos === NOS.length) {
    NOS.forEach((no) => sincronizarModo(no, 'normal'));
    mostrarNotificacao('Dados de demonstração repostos nos três nós.', 'sucesso');
  } else {
    mostrarNotificacao(`Dados repostos em ${certos} de ${NOS.length} nós. Tente de novo.`, 'erro');
  }
}

function tratarErroDeAdministracao(codigo, mensagem = 'Não foi possível concluir a acção.') {
  if (codigo === 401 || codigo === 403) {
    terminarSessao();
    irParaLogin('expirou');
    return;
  }
  mostrarNotificacao(mensagem, 'erro');
}

/* ---------------- Pequenas ajudas ---------------- */

function mostrarEstadoDaSondagem() {
  const indicador = $('#estado-sondagem');
  indicador.dataset.estado = estado.activo ? 'vivo' : 'indisponivel';
  $('#texto-sondagem').textContent = estado.activo ? 'Ao vivo' : 'Em pausa';
}

iniciar();
