/*
 * config.js — camada base (configuração).
 * Endereços do balanceador e dos nós, mapa de líderes e réplicas, tempos limite
 * e o interruptor do simulador. É o único sítio onde estes valores estão escritos.
 * Usado pelos serviços (api.js, simulador.js) e pelas páginas.
 */
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Valor por omissão: true = respostas falsas do simulador; false = backend real.
const SIMULADOR_POR_OMISSAO = true; // mudar para false quando o backend estiver publicado

/*
 * Para trocar sem mexer no código (ex.: testar o backend do colega e voltar ao simulador
 * na apresentação), abrir qualquer página com ?simulador=nao ou ?simulador=sim.
 * A escolha fica guardada neste separador até se escolher outra vez.
 */
export const USAR_SIMULADOR = escolherSimulador();

function escolherSimulador() {
  const CHAVE = 'farmarede-usar-simulador';
  const pedido = new URLSearchParams(location.search).get('simulador');
  try {
    if (pedido === 'sim' || pedido === 'nao') sessionStorage.setItem(CHAVE, pedido);
    const guardado = sessionStorage.getItem(CHAVE);
    return guardado ? guardado === 'sim' : SIMULADOR_POR_OMISSAO;
  } catch {
    return pedido ? pedido === 'sim' : SIMULADOR_POR_OMISSAO;
  }
}

export const CONFIG = local
  ? {
      balanceador: 'http://localhost:8080',
      nos: { A: 'http://localhost:3001', B: 'http://localhost:3002', C: 'http://localhost:3003' },
    }
  : {
      balanceador: 'https://farmarede-lb.onrender.com',
      nos: {
        A: 'https://farmarede-a.onrender.com',
        B: 'https://farmarede-b.onrender.com',
        C: 'https://farmarede-c.onrender.com',
      },
    };

/** Nó líder de cada farmácia: é o único que aceita escritas de stock. */
export const LIDER = { 1: 'A', 2: 'B', 3: 'C' };

/** Nó que guarda a réplica de cada farmácia (o vizinho no anel A → B → C → A). */
export const REPLICA = { 1: 'B', 2: 'C', 3: 'A' };

export const NOS = ['A', 'B', 'C'];

/** Tempos limite dos pedidos, em milissegundos. */
export const LIMITE = {
  normal: 4000, // pesquisa, login, stock
  rapido: 2000, // métricas, eventos e comandos de administração
  // Primeiro pedido da sessão: os serviços gratuitos da Render podem demorar
  // até 1 minuto a acordar, por isso esperamos mais (e avisamos aos 5 s).
  arranque: 60000,
};

/** Depois de quanto tempo à espera do primeiro pedido aparece o aviso de «a arrancar». */
export const AVISO_ARRANQUE_MS = 5000;

/** Regras do painel em tempo real. */
export const PAINEL = {
  intervaloMs: 2000, // de quanto em quanto tempo se pergunta aos nós
  semSinalMs: 6000, // um nó sem sinal há 6 s está indisponível
  lentoMs: 1000, // resposta mais demorada do que isto → nó «lento»
  maxEventos: 20, // a lista de eventos mostra no máximo 20
  janelaMs: 5000, // cada nó resume as métricas em janelas de 5 s
  pontosLatencia: 12, // 12 janelas de 5 s = o último minuto no gráfico de latência
  maisPesquisados: 5,
};
