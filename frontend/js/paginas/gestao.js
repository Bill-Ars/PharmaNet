/*
 * gestao.js — camada de páginas (ponto de entrada de gestao.html).
 * Página reservada (exigirSessao). Lê o stock no nó LÍDER da farmácia e permite editar
 * cada linha. As escritas vão sempre ao líder, com a versão lida:
 *   200 → linha actualizada · 400 → erro no campo · 401 → login
 *   409 → aviso «Outra pessoa alterou…» (sem reenviar) · 0/503 → farmácia só de leitura
 */
import { LIDER } from '../config/config.js';
import { aviso, estadoVazio, mostrarNotificacao } from '../componentes/aviso.js';
import { esqueletoLinhaStock } from '../componentes/esqueleto.js';
import { linhaStock } from '../componentes/linhaStock.js';
import { actualizarBotaoTema, navegacao } from '../componentes/navegacao.js';
import { alterarStock, lerStock } from '../servicos/api.js';
import { exigirSessao, irParaLogin, minutosRestantes, sair, terminarSessao } from '../servicos/sessao.js';
import { animarUmaVez } from '../utilitarios/animar.js';
import { $, criar, limpar, marcarRolagem, substituir } from '../utilitarios/dom.js';
import { icone, preencherIcones } from '../utilitarios/icones.js';
import { alternarTema, iniciarTema, temaActual } from '../utilitarios/tema.js';

const ERRO_QUANTIDADE = 'A quantidade tem de ser um número inteiro igual ou maior que 0.';

// Todo o estado da página num só objecto.
const estado = {
  sessao: null,
  farmaciaId: null,
  stock: [], // linhas { medicamentoId, nome, quantidade, versao }
  aEditar: null, // medicamentoId da linha em edição (só uma de cada vez)
  aGravar: false,
  erroCampo: null,
  valorEditado: null, // o texto escrito no campo (mantém-se se houver erro)
  soLeitura: false, // o líder não responde: não se pode gravar
};

function iniciar() {
  estado.sessao = exigirSessao();
  if (!estado.sessao) return; // já a caminho do login
  // O administrador não pertence a uma farmácia: começa na 1 e pode escolher outra.
  estado.farmaciaId = estado.sessao.farmaciaId ?? 1;

  montarNavegacao();
  preencherIcones();
  desenharCabecalho();
  vigiarSessao();
  carregarStock();
}

function montarNavegacao() {
  const cabecalho = navegacao(
    { paginaActual: 'gestao', tema: temaActual(), sessao: estado.sessao },
    { aoAlternarTema: alternarTema, aoSair: sair },
  );
  $('#navegacao').replaceWith(cabecalho);
  marcarRolagem(cabecalho);
  iniciarTema();
  document.addEventListener('tema-mudou', (evento) => actualizarBotaoTema(cabecalho, evento.detail.tema));
}

/* ======================================================================
   Cabeçalho e sessão
   ====================================================================== */

function desenharCabecalho() {
  $('#titulo-gestao').textContent = `Farmácia ${estado.farmaciaId}`;
  const meta = $('#meta-gestao');
  meta.removeAttribute('aria-busy');
  substituir(meta, [
    criar('span', { classe: ['etiqueta', 'etiqueta--primaria'] }, [icone('servidor', { tamanho: 14 }), `Nó líder ${LIDER[estado.farmaciaId]}`]),
    criar('span', { classe: ['etiqueta', 'etiqueta--contorno'] }, [icone('utilizador', { tamanho: 14 }), estado.sessao.utilizador]),
    criar('span', { classe: ['etiqueta', 'etiqueta--contorno'], id: 'tempo-sessao' }),
  ]);
  actualizarTempoSessao();
  if (estado.sessao.papel === 'admin') desenharEscolhaDeFarmacia();
}

// «Sessão expira em X min», actualizado a cada minuto; aos 0 a sessão termina.
function vigiarSessao() {
  setInterval(actualizarTempoSessao, 60000);
  const faltamMs = Date.parse(estado.sessao.expiraEm) - Date.now();
  setTimeout(terminarPorTempo, Math.max(0, faltamMs));
}

function actualizarTempoSessao() {
  const minutos = minutosRestantes(estado.sessao);
  if (minutos <= 0) {
    terminarPorTempo();
    return;
  }
  substituir($('#tempo-sessao'), [icone('relogio', { tamanho: 14 }), `Sessão expira em ${minutos} min`]);
}

function terminarPorTempo() {
  terminarSessao();
  irParaLogin('expirou');
}

function desenharEscolhaDeFarmacia() {
  const opcoes = Object.keys(LIDER).map((id) =>
    criar('option', { value: id, selected: Number(id) === estado.farmaciaId, texto: `Farmácia ${id} (nó ${LIDER[id]})` }),
  );
  const seleccao = criar('select', { classe: 'campo__entrada', id: 'farmacia-escolhida', onchange: mudarDeFarmacia }, opcoes);
  substituir($('#escolha-farmacia'), criar('div', { classe: ['campo', 'gestao__escolha'] }, [
    criar('label', { classe: 'campo__rotulo', for: 'farmacia-escolhida', texto: 'Farmácia a gerir' }),
    seleccao,
  ]));
}

function mudarDeFarmacia(evento) {
  estado.farmaciaId = Number(evento.target.value);
  $('#titulo-gestao').textContent = `Farmácia ${estado.farmaciaId}`;
  $('#meta-gestao .etiqueta--primaria').lastChild.textContent = `Nó líder ${LIDER[estado.farmaciaId]}`;
  carregarStock();
}

/* ======================================================================
   Leitura do stock
   ====================================================================== */

async function carregarStock() {
  estado.aEditar = null;
  estado.erroCampo = null;
  estado.valorEditado = null;
  limpar($('#zona-avisos'));
  mostrarLinhasEsqueleto();

  const farmaciaPedida = estado.farmaciaId;
  const { estado: codigo, dados } = await lerStock(farmaciaPedida);
  if (farmaciaPedida !== estado.farmaciaId) return; // o admin mudou de farmácia entretanto

  if (codigo === 200) {
    estado.stock = dados.stock;
    definirSoLeitura(false);
    desenharTabela();
  } else if (codigo === 0 || codigo === 503) {
    definirSoLeitura(true);
    mostrarStockIndisponivel();
  } else {
    mostrarStockIndisponivel('Não foi possível ler o stock desta farmácia.');
  }
}

function mostrarLinhasEsqueleto() {
  const corpo = $('#linhas-stock');
  corpo.setAttribute('aria-busy', 'true');
  substituir(corpo, [esqueletoLinhaStock(), esqueletoLinhaStock(), esqueletoLinhaStock()]);
}

function mostrarStockIndisponivel(titulo = 'O stock não pode ser lido enquanto o nó líder não responder.') {
  const corpo = $('#linhas-stock');
  corpo.removeAttribute('aria-busy');
  limpar(corpo);
  substituir($('#zona-avisos'), estadoVazio({ titulo, texto: 'Tente de novo dentro de alguns segundos.' }));
}

/* ======================================================================
   Desenho da tabela (cada linha vem do componente linhaStock)
   ====================================================================== */

function desenharTabela() {
  const corpo = $('#linhas-stock');
  corpo.removeAttribute('aria-busy');
  substituir(corpo, estado.stock.map(desenharLinha));
}

function desenharLinha(item) {
  const aEditar = estado.aEditar === item.medicamentoId;
  return linhaStock(
    item,
    {
      aEditar,
      aGravar: aEditar && estado.aGravar,
      soLeitura: estado.soLeitura,
      erro: aEditar ? estado.erroCampo : null,
      valor: aEditar ? estado.valorEditado : null,
    },
    {
      aoEditar: () => editar(item.medicamentoId),
      aoCancelar: cancelarEdicao,
      aoGravar: (texto) => gravar(item.medicamentoId, texto),
    },
  );
}

/** Volta a desenhar só uma linha (o resto da tabela não mexe). */
function redesenharLinha(medicamentoId) {
  const antiga = $(`#linhas-stock tr[data-medicamento="${medicamentoId}"]`);
  const item = estado.stock.find((linha) => linha.medicamentoId === medicamentoId);
  if (!antiga || !item) return null;
  const nova = desenharLinha(item);
  antiga.replaceWith(nova);
  return nova;
}

/* ======================================================================
   Edição
   ====================================================================== */

function editar(medicamentoId) {
  const anterior = estado.aEditar;
  estado.aEditar = medicamentoId;
  estado.erroCampo = null;
  estado.valorEditado = null;
  limpar($('#zona-avisos'));
  if (anterior !== null) redesenharLinha(anterior); // só uma linha em edição de cada vez
  redesenharLinha(medicamentoId);
  const campo = $(`#quantidade-${medicamentoId}`);
  campo.focus();
  campo.select();
}

function cancelarEdicao() {
  const medicamentoId = estado.aEditar;
  estado.aEditar = null;
  estado.erroCampo = null;
  estado.valorEditado = null;
  devolverFoco(redesenharLinha(medicamentoId));
}

async function gravar(medicamentoId, texto) {
  if (estado.aGravar || estado.soLeitura) return;
  estado.valorEditado = String(texto);
  // Validação no frontend (o backend valida outra vez).
  if (!/^\d+$/.test(String(texto).trim())) {
    mostrarErroNoCampo(medicamentoId, ERRO_QUANTIDADE);
    return;
  }
  const item = estado.stock.find((linha) => linha.medicamentoId === medicamentoId);
  estado.aGravar = true;
  estado.erroCampo = null;
  redesenharLinha(medicamentoId);

  const resposta = await alterarStock(estado.farmaciaId, medicamentoId, Number(texto), item.versao, estado.sessao.token);
  estado.aGravar = false;
  tratarRespostaDaGravacao(resposta, item);
}

function tratarRespostaDaGravacao({ estado: codigo, dados }, item) {
  if (codigo === 200) return gravado(item, dados);
  if (codigo === 400) return mostrarErroNoCampo(item.medicamentoId, ERRO_QUANTIDADE);
  if (codigo === 401) return sessaoRecusada();
  if (codigo === 409) return conflito(item, dados.actual);
  if (codigo === 0 || codigo === 503) {
    definirSoLeitura(true);
    return redesenharLinha(item.medicamentoId);
  }
  redesenharLinha(item.medicamentoId);
  return mostrarAvisoTopo(aviso({ tipo: 'erro', titulo: 'Não foi possível gravar. Tente de novo.' }));
}

function gravado(item, { quantidade, versao }) {
  item.quantidade = quantidade;
  item.versao = versao;
  estado.aEditar = null;
  estado.valorEditado = null;
  const linha = redesenharLinha(item.medicamentoId);
  animarUmaVez(linha, 'tabela__linha--gravada');
  devolverFoco(linha);
  mostrarNotificacao('Gravado.', 'sucesso');
}

// 409: outra pessoa gravou primeiro. Avisamos e esperamos que a pessoa recarregue.
function conflito(item, actual) {
  redesenharLinha(item.medicamentoId);
  const caixa = aviso(
    { tipo: 'erro', titulo: 'Outra pessoa alterou este medicamento.', texto: `${item.nome} — valor actual: ${actual.quantidade}.` },
    { accao: { rotulo: 'Recarregar', icone: 'recarregar', aoClicar: carregarStock } },
  );
  mostrarAvisoTopo(caixa);
  animarUmaVez(caixa, 'anim-abanar');
}

function sessaoRecusada() {
  terminarSessao();
  irParaLogin('expirou');
}

function mostrarErroNoCampo(medicamentoId, mensagem) {
  estado.erroCampo = mensagem;
  redesenharLinha(medicamentoId);
  $(`#quantidade-${medicamentoId}`).focus();
}

/* ======================================================================
   Modo «só de leitura» (o nó líder não responde)
   ====================================================================== */

function definirSoLeitura(soLeitura) {
  const mudou = estado.soLeitura !== soLeitura;
  estado.soLeitura = soLeitura;
  if (!soLeitura) {
    limpar($('#faixa-estado'));
  } else {
    substituir($('#faixa-estado'), aviso(
      { tipo: 'aviso', icone: 'cadeado', titulo: 'Esta farmácia está só de leitura: o seu nó líder não responde.' },
      { accao: { rotulo: 'Tentar de novo', icone: 'recarregar', aoClicar: carregarStock } },
    ));
    $('#faixa-estado').firstChild.classList.add('aviso--faixa');
  }
  if (mudou && estado.stock.length) desenharTabela(); // activa ou desactiva os botões de edição
}

/* ---------------- Pequenas ajudas ---------------- */

function mostrarAvisoTopo(elemento) {
  substituir($('#zona-avisos'), elemento);
}

// Depois de gravar ou cancelar, o foco volta ao botão «Editar» da mesma linha.
function devolverFoco(linha) {
  linha?.querySelector('.tabela__accoes button')?.focus();
}

iniciar();
