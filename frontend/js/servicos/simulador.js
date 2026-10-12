/*
 * simulador.js — camada de serviços.
 * Finge ser o balanceador e os nós A, B e C, para o frontend funcionar sem backend.
 * Responde no mesmo formato do contrato da API (com atrasos de 100–400 ms),
 * e reproduz as falhas: nó parado (a farmácia passa à réplica), nó lento (6 s), conflitos 409.
 * Só é usado por api.js. Na consola do navegador: simulador.ajuda().
 */
import { LIDER, NOS, REPLICA, USAR_SIMULADOR } from '../config/config.js';
import { normalizar } from '../utilitarios/formatar.js';
import { CHAVE_SESSAO } from './sessao.js';

const CHAVE = 'farmarede-simulador';
const ATRASO_MINIMO_MS = 100;
const ATRASO_MAXIMO_MS = 400;
const ATRASO_LENTO_MS = 6000;
// Para o painel, um nó lento ainda responde (devagar) dentro dos 2 s: assim vê-se «lento».
const ATRASO_PAINEL_LENTO = [1200, 1800];
const ESPERA_PELO_LIDER_MS = 1500; // o coordenador desiste do líder ao fim de 1,5 s
const JANELA_MS = 5000;
const NUNCA_MS = 10 * 60 * 1000; // nó parado: a resposta nunca chega a tempo
const DURACAO_SESSAO_MS = 15 * 60 * 1000;
const MODOS = ['normal', 'parado', 'lento'];
const ALGORITMOS = ['round-robin', 'menos-ligacoes', 'pesos'];
const PESOS = { A: 3, B: 2, C: 1 };

const MEDICAMENTOS = [
  { id: 1, nome: 'Paracetamol', dosagem: '500 mg', apresentacao: 'comprimidos' },
  { id: 2, nome: 'Ibuprofeno', dosagem: '400 mg', apresentacao: 'comprimidos' },
  { id: 3, nome: 'Amoxicilina', dosagem: '500 mg', apresentacao: 'cápsulas' },
  { id: 4, nome: 'Metformina', dosagem: '850 mg', apresentacao: 'comprimidos' },
  { id: 5, nome: 'Artemeter + Lumefantrina', dosagem: '20/120 mg', apresentacao: 'comprimidos' },
  { id: 6, nome: 'Sais de reidratação oral', dosagem: '20,5 g', apresentacao: 'saquetas' },
  { id: 7, nome: 'Omeprazol', dosagem: '20 mg', apresentacao: 'cápsulas' },
  { id: 8, nome: 'Salbutamol', dosagem: '100 mcg', apresentacao: 'inalador' },
  { id: 9, nome: 'Cotrimoxazol', dosagem: '480 mg', apresentacao: 'comprimidos' },
  { id: 10, nome: 'Losartan', dosagem: '50 mg', apresentacao: 'comprimidos' },
];

const UTILIZADORES = {
  operador1: { palavraPasse: 'teste123', papel: 'operador', farmaciaId: 1 },
  operador2: { palavraPasse: 'teste123', papel: 'operador', farmaciaId: 2 },
  operador3: { palavraPasse: 'teste123', papel: 'operador', farmaciaId: 3 },
  admin: { palavraPasse: 'admin123', papel: 'admin', farmaciaId: null },
};

const ROTAS = [
  { metodo: 'GET', padrao: /^\/v1\/pesquisa$/, tratar: tratarPesquisa },
  { metodo: 'GET', padrao: /^\/v1\/medicamentos$/, tratar: tratarMedicamentos },
  { metodo: 'POST', padrao: /^\/v1\/login$/, tratar: tratarLogin },
  { metodo: 'GET', padrao: /^\/v1\/farmacias\/(\d+)\/stock$/, tratar: tratarLerStock },
  { metodo: 'PUT', padrao: /^\/v1\/farmacias\/(\d+)\/stock\/(\d+)$/, tratar: tratarAlterarStock },
  { metodo: 'GET', padrao: /^\/v1\/metricas$/, tratar: tratarMetricas },
  { metodo: 'GET', padrao: /^\/v1\/eventos$/, tratar: tratarEventos },
  { metodo: 'POST', padrao: /^\/v1\/admin\/modo$/, tratar: tratarModo },
  { metodo: 'POST', padrao: /^\/v1\/admin\/algoritmo$/, tratar: tratarAlgoritmo },
  { metodo: 'POST', padrao: /^\/v1\/admin\/repor$/, tratar: tratarRepor },
];

// O estado fica no sessionStorage para sobreviver à mudança de página (no mesmo separador).
let estado = carregar();

/* ======================================================================
   Entrada: chamada por api.js
   ====================================================================== */

/**
 * Responde a um pedido como o backend responderia.
 * @returns {Promise<{estado:number, dados:any}>}
 */
export async function responderSimulado({ destino, metodo, caminho, corpo, token }) {
  const url = new URL(caminho, 'http://simulador');
  const rota = ROTAS.find((r) => r.metodo === metodo && r.padrao.test(url.pathname));
  const resultado = rota
    ? rota.tratar({ destino, url, corpo, token, parametros: url.pathname.match(rota.padrao).slice(1) })
    : responder(404, { erro: 'rota-desconhecida' });
  guardar();
  await esperar(resultado.demoraMs);
  // Uma cópia, para a página nunca mexer no estado interno do simulador.
  return { estado: resultado.estado, dados: structuredClone(resultado.dados) };
}

/* ======================================================================
   Rotas do balanceador
   ====================================================================== */

function tratarPesquisa({ url }) {
  const coordenador = escolherCoordenador();
  if (!coordenador) return responder(503, { erro: 'sem-nos-disponiveis' });
  registarPedido(coordenador);

  const medicamento = encontrarMedicamento(url.searchParams.get('q') ?? '');
  if (!medicamento) return responder(404, { erro: 'nao-encontrado' }, atrasoDoNo(coordenador));
  // Cada nó conta as pesquisas que coordenou (o painel soma os três).
  const contagem = (estado.pesquisas[coordenador] ??= {});
  contagem[medicamento.nome] = (contagem[medicamento.nome] ?? 0) + 1;

  const farmacias = Object.keys(LIDER).map((id) => consultarFarmacia(Number(id), medicamento.id));
  // Se algum líder falhou, o coordenador esperou 1,5 s por ele antes de ir à réplica.
  const esperouPeloLider = farmacias.some((farmacia) => farmacia.origem !== 'lider');
  const demora = atrasoDoNo(coordenador) + (esperouPeloLider ? ESPERA_PELO_LIDER_MS : 0);
  return responder(200, { medicamento, coordenador, tempoMs: demora, farmacias }, demora);
}

function consultarFarmacia(farmaciaId, medicamentoId) {
  const lider = LIDER[farmaciaId];
  const replica = REPLICA[farmaciaId];
  let origem = 'indisponivel';
  if (respondeATempo(lider)) origem = 'lider';
  else if (respondeATempo(replica)) origem = 'replica';

  if (origem === 'replica') registarEvento(replica, 'replica', `Farmácia ${farmaciaId} servida pela réplica`);
  const linha = estado.stock[farmaciaId][medicamentoId];
  return {
    id: farmaciaId,
    nome: `Farmácia ${farmaciaId}`,
    disponivel: origem === 'indisponivel' ? null : linha.quantidade > 0,
    origem,
  };
}

function tratarMedicamentos() {
  const coordenador = escolherCoordenador();
  if (!coordenador) return responder(503, { erro: 'sem-nos-disponiveis' });
  return responder(200, MEDICAMENTOS, atrasoDoNo(coordenador));
}

function tratarLogin({ corpo }) {
  const agora = Date.now();
  estado.tentativasFalhadas = estado.tentativasFalhadas.filter((hora) => agora - hora < 60000);
  if (estado.tentativasFalhadas.length >= 5) {
    const segundos = Math.ceil((60000 - (agora - estado.tentativasFalhadas[0])) / 1000);
    return responder(429, { erro: 'demasiadas-tentativas', tentarDentroDe: segundos });
  }

  const nome = String(corpo?.utilizador ?? '').trim().toLowerCase();
  const conta = UTILIZADORES[nome];
  if (!conta || conta.palavraPasse !== corpo?.palavraPasse) {
    estado.tentativasFalhadas.push(agora);
    return responder(401, { erro: 'credenciais-invalidas' });
  }

  const token = gerarToken();
  const expiraEm = new Date(agora + DURACAO_SESSAO_MS).toISOString();
  estado.sessoes[token] = { utilizador: nome, papel: conta.papel, farmaciaId: conta.farmaciaId, expiraEm };
  return responder(200, { token, expiraEm, papel: conta.papel, farmaciaId: conta.farmaciaId });
}

function tratarAlgoritmo({ corpo, token }) {
  const negado = verificarAdmin(token);
  if (negado) return negado;
  if (!ALGORITMOS.includes(corpo?.algoritmo)) return responder(400, { erro: 'algoritmo-invalido' });
  estado.algoritmo = corpo.algoritmo;
  return responder(200, { algoritmo: estado.algoritmo });
}

/* ======================================================================
   Rotas dos nós
   ====================================================================== */

function tratarLerStock({ destino, parametros }) {
  const farmaciaId = Number(parametros[0]);
  if (!estado.stock[farmaciaId]) return responder(404, { erro: 'farmacia-desconhecida' });
  if (LIDER[farmaciaId] !== destino) return responder(403, { erro: 'nao-e-lider' });
  registarPedido(destino);

  const stock = MEDICAMENTOS.map((medicamento) => ({
    medicamentoId: medicamento.id,
    nome: `${medicamento.nome} ${medicamento.dosagem}`,
    ...estado.stock[farmaciaId][medicamento.id],
  }));
  return responder(200, { farmaciaId, origem: 'lider', stock }, atrasoDoNo(destino));
}

function tratarAlterarStock({ destino, parametros, corpo, token }) {
  const [farmaciaId, medicamentoId] = parametros.map(Number);
  const demora = atrasoDoNo(destino);
  const sessao = sessaoValida(token);
  if (!sessao) return responder(401, { erro: 'sessao-invalida' }, demora);
  if (sessao.papel !== 'admin' && sessao.farmaciaId !== farmaciaId) return responder(403, { erro: 'sem-permissao' }, demora);
  if (LIDER[farmaciaId] !== destino) return responder(403, { erro: 'nao-e-lider' }, demora);

  const linha = estado.stock[farmaciaId]?.[medicamentoId];
  if (!linha) return responder(404, { erro: 'medicamento-desconhecido' }, demora);
  if (!Number.isInteger(corpo?.quantidade) || corpo.quantidade < 0) {
    return responder(400, { erro: 'quantidade-invalida' }, demora);
  }
  if (corpo.versao !== linha.versao) {
    estado.conflitos.push({ no: destino, hora: Date.now() });
    registarEvento(destino, 'conflito', `409 na Farmácia ${farmaciaId}`);
    return responder(409, { erro: 'conflito', actual: { ...linha } }, demora);
  }

  linha.quantidade = corpo.quantidade;
  linha.versao += 1;
  registarEvento(destino, 'escrita', `Farmácia ${farmaciaId}: stock gravado (v${linha.versao})`);
  return responder(200, { medicamentoId, ...linha }, demora);
}

function tratarMetricas({ destino }) {
  const agora = Date.now();
  const naJanela = (registo) => registo.no === destino && agora - registo.hora < JANELA_MS;
  // Com outro nó em baixo, os coordenadores esperam pelos líderes: a latência sobe.
  const haFalhas = NOS.some((no) => no !== destino && estado.modos[no] !== 'normal');
  const mediana = inteiroAleatorio(80, 180) + (haFalhas ? inteiroAleatorio(400, 900) : 0);

  return responder(200, {
    no: destino,
    modo: estado.modos[destino],
    lider: farmaciaLideradaPor(destino),
    replica: farmaciaReplicadaPor(destino),
    ultimoSinal: new Date(agora - inteiroAleatorio(0, 1800)).toISOString(),
    janela: {
      inicio: new Date(agora - JANELA_MS).toISOString(),
      pedidos: estado.pedidos.filter(naJanela).length + inteiroAleatorio(0, 4), // + tráfego de fundo
      medianaMs: mediana,
      p95Ms: mediana + inteiroAleatorio(120, 320),
      conflitos409: estado.conflitos.filter(naJanela).length,
      atrasoReplicaMs: inteiroAleatorio(20, 90),
      maisPesquisados: maisPesquisados(destino),
    },
  }, atrasoDoPainel(destino));
}

function tratarEventos({ destino, url }) {
  const desde = Number(url.searchParams.get('desde')) || 0;
  const eventos = estado.eventos.filter((evento) => evento.no === destino && evento.id > desde);
  return responder(200, { eventos }, atrasoDoPainel(destino));
}

// Os comandos de administração chegam sempre ao nó, mesmo «parado» (é uma falha simulada).
function tratarModo({ destino, corpo, token }) {
  const negado = verificarAdmin(token);
  if (negado) return negado;
  if (!MODOS.includes(corpo?.modo)) return responder(400, { erro: 'modo-invalido' });
  definirModo(destino, corpo.modo);
  return responder(200, { no: destino, modo: corpo.modo });
}

function tratarRepor({ destino, token }) {
  const negado = verificarAdmin(token);
  if (negado) return negado;
  const farmaciaId = farmaciaLideradaPor(destino);
  estado.stock[farmaciaId] = stockInicial()[farmaciaId];
  definirModo(destino, 'normal');
  registarEvento(destino, 'reposicao', `Dados da Farmácia ${farmaciaId} repostos`);
  return responder(200, { no: destino, reposto: true });
}

/* ======================================================================
   Regras da rede
   ====================================================================== */

/** Escolhe o nó coordenador entre os que não estão parados, segundo o algoritmo do balanceador. */
function escolherCoordenador() {
  const vivos = NOS.filter((no) => estado.modos[no] !== 'parado');
  if (vivos.length === 0) return null;

  if (estado.algoritmo === 'menos-ligacoes') {
    const carga = (no) => estado.pedidos.filter((p) => p.no === no && Date.now() - p.hora < JANELA_MS).length;
    return [...vivos].sort((a, b) => carga(a) - carga(b))[0];
  }
  const roda = estado.algoritmo === 'pesos' ? vivos.flatMap((no) => Array(PESOS[no]).fill(no)) : vivos;
  const escolhido = roda[estado.proximo % roda.length];
  estado.proximo += 1;
  return escolhido;
}

// Um nó lento demora mais de 1,5 s: para o coordenador, conta como falha.
function respondeATempo(no) {
  return estado.modos[no] === 'normal';
}

function atrasoDoNo(no) {
  if (estado.modos[no] === 'parado') return NUNCA_MS;
  if (estado.modos[no] === 'lento') return ATRASO_LENTO_MS;
  return atrasoAleatorio();
}

// Métricas e eventos: o nó lento responde em 1,2–1,8 s (o painel mostra-o como «lento»).
function atrasoDoPainel(no) {
  if (estado.modos[no] === 'lento') return inteiroAleatorio(...ATRASO_PAINEL_LENTO);
  return atrasoDoNo(no);
}

function encontrarMedicamento(texto) {
  const procurado = normalizar(texto);
  if (!procurado) return null;
  const comeca = MEDICAMENTOS.find((m) => normalizar(m.nome).startsWith(procurado));
  return comeca ?? MEDICAMENTOS.find((m) => normalizar(m.nome).includes(procurado)) ?? null;
}

function definirModo(no, modo) {
  if (estado.modos[no] === modo) return;
  estado.modos[no] = modo;
  registarEvento(no, 'modo', `Nó ${no} passou a «${modo}»`);
}

function sessaoValida(token) {
  const sessao = estado.sessoes[token];
  if (!sessao || Date.parse(sessao.expiraEm) < Date.now()) return null;
  return sessao;
}

function verificarAdmin(token) {
  const sessao = sessaoValida(token);
  if (!sessao) return responder(401, { erro: 'sessao-invalida' });
  if (sessao.papel !== 'admin') return responder(403, { erro: 'sem-permissao' });
  return null;
}

function farmaciaLideradaPor(no) {
  return Number(Object.keys(LIDER).find((id) => LIDER[id] === no));
}

function farmaciaReplicadaPor(no) {
  return Number(Object.keys(REPLICA).find((id) => REPLICA[id] === no));
}

function maisPesquisados(no) {
  return Object.entries(estado.pesquisas[no] ?? {})
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

/* ======================================================================
   Registos (pedidos e eventos)
   ====================================================================== */

function registarPedido(no) {
  const agora = Date.now();
  estado.pedidos = estado.pedidos.filter((p) => agora - p.hora < 60000);
  estado.pedidos.push({ no, hora: agora });
}

function registarEvento(no, tipo, detalhe) {
  estado.eventos.push({ id: estado.proximoEvento, hora: new Date().toISOString(), no, tipo, detalhe });
  estado.proximoEvento += 1;
  estado.eventos = estado.eventos.slice(-100);
}

/* ======================================================================
   Estado inicial e persistência
   ====================================================================== */

function estadoInicial() {
  return {
    modos: { A: 'normal', B: 'normal', C: 'normal' },
    algoritmo: 'round-robin',
    proximo: 0,
    stock: stockInicial(),
    sessoes: {},
    tentativasFalhadas: [],
    pedidos: [],
    conflitos: [],
    pesquisas: {}, // por nó: { A: { Paracetamol: 3 } }
    eventos: [],
    proximoEvento: 1,
  };
}

// Valores fixos mas variados: algumas farmácias sem stock de alguns medicamentos.
function stockInicial() {
  const stock = {};
  for (const farmaciaId of [1, 2, 3]) {
    stock[farmaciaId] = {};
    for (const { id } of MEDICAMENTOS) {
      const base = (id * 7 + farmaciaId * 5) % 13;
      stock[farmaciaId][id] = { quantidade: base < 3 ? 0 : base * 2, versao: 1 + ((id + farmaciaId) % 4) };
    }
  }
  return stock;
}

function carregar() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CHAVE));
    return guardado ?? estadoInicial();
  } catch {
    return estadoInicial();
  }
}

function guardar() {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // sem armazenamento: o simulador continua a funcionar só em memória
  }
}

/* ======================================================================
   Pequenas ajudas
   ====================================================================== */

function responder(codigo, dados, demoraMs = atrasoAleatorio()) {
  return { estado: codigo, dados, demoraMs };
}

function esperar(milissegundos) {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}

function atrasoAleatorio() {
  return inteiroAleatorio(ATRASO_MINIMO_MS, ATRASO_MAXIMO_MS);
}

function inteiroAleatorio(minimo, maximo) {
  return minimo + Math.floor(Math.random() * (maximo - minimo + 1));
}

function gerarToken() {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `sim-${aleatorio}`;
}

/* ======================================================================
   Comandos para a consola do navegador (só com o simulador ligado)
   ====================================================================== */

const comandosDaConsola = {
  /** simulador.mudarModo('A', 'parado') — modos: normal, parado, lento. */
  mudarModo(no, modo) {
    if (!NOS.includes(no) || !MODOS.includes(modo)) return 'Use: simulador.mudarModo("A", "parado"|"lento"|"normal")';
    definirModo(no, modo);
    guardar();
    return { ...estado.modos };
  },
  /** Mostra o modo de cada nó. */
  modos() {
    return { ...estado.modos };
  },
  /** Simula outro operador a gravar primeiro (para provocar um 409). */
  alterarPorOutraPessoa(farmaciaId = 1, medicamentoId = 1) {
    const linha = estado.stock[farmaciaId][medicamentoId];
    linha.quantidade = Math.max(0, linha.quantidade - 1);
    linha.versao += 1;
    guardar();
    return { ...linha };
  },
  /** Faz a sessão actual expirar já (no «servidor» e neste separador), para testar o regresso ao login. */
  expirarSessao() {
    const passado = new Date(Date.now() - 1000).toISOString();
    try {
      const sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO));
      if (!sessao) return 'Não há sessão iniciada.';
      if (estado.sessoes[sessao.token]) estado.sessoes[sessao.token].expiraEm = passado;
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ ...sessao, expiraEm: passado }));
      guardar();
      return 'Sessão expirada. Recarregue a página ou mude de página.';
    } catch {
      return 'Não foi possível ler a sessão.';
    }
  },
  /** Volta tudo ao início (nós normais, stock original). */
  repor() {
    estado = estadoInicial();
    guardar();
    return 'Simulador reposto.';
  },
  ajuda() {
    return [
      'simulador.modos()                          → modo de cada nó',
      'simulador.mudarModo("A", "parado")         → normal | parado | lento',
      'simulador.alterarPorOutraPessoa(1, 1)      → provoca um 409 na próxima gravação',
      'simulador.expirarSessao()                  → a sessão expira (testar regresso ao login)',
      'simulador.repor()                          → volta ao início',
    ].join('\n');
  },
};

if (USAR_SIMULADOR) {
  globalThis.simulador = comandosDaConsola;
}
