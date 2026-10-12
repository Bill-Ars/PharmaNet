/*
 * api.js — camada de serviços.
 * O ÚNICO ficheiro com fetch. Cada função corresponde a uma rota do backend
 * e devolve sempre { estado, dados } — nunca lança excepções para a página.
 * estado = código HTTP (200, 401, 409…) ou 0 quando não houve resposta a tempo.
 * Com USAR_SIMULADOR = true, as respostas vêm de simulador.js, no mesmo formato.
 * As respostas 200 passam por «normalizar…»: se o backend omitir um campo, a página
 * recebe um valor seguro (0, lista vazia…) em vez de rebentar. Contrato: CONTRATO-API.md.
 */
import { CONFIG, LIDER, LIMITE, NOS, USAR_SIMULADOR } from '../config/config.js';
import { responderSimulado } from './simulador.js';

/* ---------------- Pedido genérico ---------------- */

/**
 * Faz um pedido HTTP a um destino ('balanceador', 'A', 'B' ou 'C').
 * @returns {Promise<{estado:number, dados:any}>}
 */
export async function pedir(destino, caminho, { metodo = 'GET', corpo, token, limiteMs = LIMITE.normal } = {}) {
  if (USAR_SIMULADOR) {
    return comTempoLimite(responderSimulado({ destino, metodo, caminho, corpo, token }), limiteMs);
  }
  return pedirAoServidor(enderecoDe(destino) + caminho, { metodo, corpo, token, limiteMs });
}

async function pedirAoServidor(url, { metodo, corpo, token, limiteMs }) {
  // O AbortController corta o pedido quando o tempo limite acaba.
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), limiteMs);
  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: cabecalhos(corpo, token),
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controlador.signal,
    });
    return { estado: resposta.status, dados: await lerJson(resposta) };
  } catch {
    // Rede em baixo, CORS ou tempo esgotado: para a página é tudo «sem resposta».
    return { estado: 0, dados: null };
  } finally {
    clearTimeout(temporizador);
  }
}

function enderecoDe(destino) {
  return destino === 'balanceador' ? CONFIG.balanceador : CONFIG.nos[destino];
}

function cabecalhos(corpo, token) {
  const lista = { Accept: 'application/json' };
  if (corpo !== undefined) lista['Content-Type'] = 'application/json';
  if (token) lista.Authorization = `Bearer ${token}`;
  return lista;
}

// Uma resposta sem corpo (ou com corpo que não é JSON) não deve rebentar a página.
async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

// O simulador não usa fetch, por isso o tempo limite é aplicado com uma «corrida».
function comTempoLimite(promessa, limiteMs) {
  const esgotado = new Promise((resolver) => {
    setTimeout(() => resolver({ estado: 0, dados: null }), limiteMs);
  });
  return Promise.race([promessa, esgotado]);
}

/* ---------------- Rotas públicas (via balanceador) ---------------- */

/** Pesquisa um medicamento nas três farmácias. */
export async function pesquisar(texto, { limiteMs = LIMITE.normal } = {}) {
  const resposta = await pedir('balanceador', `/v1/pesquisa?q=${encodeURIComponent(texto)}`, { limiteMs });
  return normalizar(resposta, normalizarPesquisa);
}

export async function listarMedicamentos() {
  const resposta = await pedir('balanceador', '/v1/medicamentos');
  return normalizar(resposta, (dados) => lista(dados));
}

export function entrar(utilizador, palavraPasse) {
  return pedir('balanceador', '/v1/login', { metodo: 'POST', corpo: { utilizador, palavraPasse } });
}

/* ---------------- Stock (directamente ao nó líder) ---------------- */

/** Lê o stock no nó líder da farmácia (nunca no balanceador). */
export async function lerStock(farmaciaId) {
  const resposta = await pedir(LIDER[farmaciaId], `/v1/farmacias/${farmaciaId}/stock`);
  return normalizar(resposta, (dados) => ({ farmaciaId, origem: 'lider', ...dados, stock: lista(dados?.stock) }));
}

/** Grava uma quantidade. Só o líder aceita escritas; versão antiga → 409. */
export function alterarStock(farmaciaId, medicamentoId, quantidade, versao, token) {
  return pedir(LIDER[farmaciaId], `/v1/farmacias/${farmaciaId}/stock/${medicamentoId}`, {
    metodo: 'PUT',
    corpo: { quantidade, versao },
    token,
  });
}

/* ---------------- Painel e administração ---------------- */

export async function lerMetricas(no) {
  const resposta = await pedir(no, '/v1/metricas', { limiteMs: LIMITE.rapido });
  return normalizar(resposta, (dados) => normalizarMetricas(dados, no));
}

export async function lerEventos(no, desde = 0) {
  const resposta = await pedir(no, `/v1/eventos?desde=${encodeURIComponent(desde)}`, { limiteMs: LIMITE.rapido });
  return normalizar(resposta, (dados) => ({ eventos: lista(dados?.eventos).map((evento) => ({ no, ...evento })) }));
}

export function mudarModo(no, modo, token) {
  return pedir(no, '/v1/admin/modo', { metodo: 'POST', corpo: { modo }, token, limiteMs: LIMITE.rapido });
}

export function mudarAlgoritmo(algoritmo, token) {
  return pedir('balanceador', '/v1/admin/algoritmo', {
    metodo: 'POST',
    corpo: { algoritmo },
    token,
    limiteMs: LIMITE.rapido,
  });
}

/** Repõe os dados de demonstração em cada nó; devolve uma resposta por nó. */
export function reporDados(token) {
  const pedidos = NOS.map((no) => pedir(no, '/v1/admin/repor', { metodo: 'POST', token }));
  return Promise.all(pedidos);
}

/* ---------------- Normalização das respostas ---------------- */

// Só se normalizam respostas 200; os erros seguem como chegaram.
function normalizar(resposta, transformar) {
  if (resposta.estado !== 200) return resposta;
  return { estado: resposta.estado, dados: transformar(resposta.dados) };
}

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function numero(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : 0;
}

function normalizarPesquisa(dados) {
  return {
    medicamento: { nome: '', dosagem: '', apresentacao: '', ...dados?.medicamento },
    coordenador: dados?.coordenador ?? '?',
    tempoMs: numero(dados?.tempoMs),
    farmacias: lista(dados?.farmacias).map((farmacia) => ({
      ...farmacia,
      nome: farmacia.nome ?? `Farmácia ${farmacia.id}`,
      origem: farmacia.origem ?? 'indisponivel',
      disponivel: farmacia.disponivel ?? null,
    })),
  };
}

function normalizarMetricas(dados, no) {
  const janela = dados?.janela ?? {};
  return {
    ...dados,
    no: dados?.no ?? no,
    modo: dados?.modo ?? 'normal',
    janela: {
      ...janela,
      pedidos: numero(janela.pedidos),
      medianaMs: numero(janela.medianaMs),
      p95Ms: numero(janela.p95Ms),
      conflitos409: numero(janela.conflitos409),
      atrasoReplicaMs: numero(janela.atrasoReplicaMs),
      maisPesquisados: lista(janela.maisPesquisados),
    },
  };
}
