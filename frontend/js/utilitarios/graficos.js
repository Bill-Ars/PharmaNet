/*
 * graficos.js — camada base (utilitários).
 * O que os dois gráficos do painel têm em comum: saber se o Chart.js carregou,
 * as cores tiradas dos tokens (mudam com o modo escuro) e as opções de base.
 * O Chart.js vem de um CDN por <script> em painel.html e fica em window.Chart.
 * Usado por componentes/graficoPedidos.js e componentes/graficoLatencia.js.
 */
import { lerDuracao, movimentoReduzido } from './animar.js';
import { lerToken } from './tema.js';

/** true se o Chart.js carregou (sem internet, o CDN pode falhar). */
export function bibliotecaDisponivel() {
  return typeof window.Chart === 'function';
}

/** Cores dos gráficos, lidas agora dos tokens (por isso seguem o tema actual). */
export function coresDosGraficos() {
  return {
    texto: lerToken('--cor-texto-suave'),
    grelha: lerToken('--cor-borda'),
    superficie: lerToken('--cor-superficie'),
    primaria: lerToken('--cor-primaria'),
    primariaSuave: lerToken('--cor-primaria-suave'),
    aviso: lerToken('--cor-aviso'),
    neutra: lerToken('--cor-neutra'),
    fonte: lerToken('--fonte-base'),
  };
}

/** Opções comuns: sem animação com «reduzir movimento», eixos e legendas nas cores do tema. */
export function opcoesBase(cores) {
  // O tipo de letra do site também nos gráficos (definição global do Chart.js).
  window.Chart.defaults.font.family = cores.fonte;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: movimentoReduzido() ? 0 : lerDuracao('--duracao-grafico') },
    plugins: {
      legend: { labels: { color: cores.texto, boxWidth: 12, boxHeight: 12 } },
    },
    scales: {
      x: eixo(cores, false),
      y: eixo(cores, true),
    },
  };
}

function eixo(cores, comGrelha) {
  return {
    beginAtZero: true,
    border: { display: false },
    grid: { display: comGrelha, color: cores.grelha },
    ticks: { color: cores.texto },
  };
}
