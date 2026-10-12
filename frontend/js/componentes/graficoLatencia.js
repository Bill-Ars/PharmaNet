/*
 * graficoLatencia.js — camada de componentes.
 * Gráfico de linhas com a latência das últimas 12 janelas de 5 s (1 minuto):
 * mediana (linha cheia, cor principal) e p95 (linha tracejada, âmbar).
 * Devolve { elemento, actualizar(janelas), mudarTema() }, como o graficoPedidos.
 * Usado por paginas/painel.js.
 */
import { criar } from '../utilitarios/dom.js';
import { formatarHora } from '../utilitarios/formatar.js';
import { bibliotecaDisponivel, coresDosGraficos, opcoesBase } from '../utilitarios/graficos.js';

export function graficoLatencia() {
  const tela = criar('canvas', { role: 'img', 'aria-label': 'Latência: à espera dos primeiros dados.' });
  const elemento = criar('div', { classe: 'grafico' }, tela);
  if (!bibliotecaDisponivel()) {
    elemento.replaceChildren(criar('p', { classe: 'grafico__sem-biblioteca', texto: 'Não foi possível carregar o gráfico.' }));
    return { elemento, actualizar() {}, mudarTema() {} };
  }

  let grafico = null;
  let ultimasJanelas = [];

  /** @param {Array<{hora:number, medianaMs:number, p95Ms:number}>} janelas da mais antiga para a mais recente */
  function actualizar(janelas) {
    ultimasJanelas = janelas;
    grafico ??= new window.Chart(tela, configuracao(coresDosGraficos()));
    grafico.data.labels = janelas.map((janela) => formatarHora(janela.hora));
    grafico.data.datasets[0].data = janelas.map((janela) => janela.medianaMs);
    grafico.data.datasets[1].data = janelas.map((janela) => janela.p95Ms);
    grafico.update();
    descrever(janelas);
  }

  function mudarTema() {
    if (!grafico) return;
    grafico.destroy();
    grafico = null;
    actualizar(ultimasJanelas);
  }

  function descrever(janelas) {
    const ultima = janelas.at(-1);
    const frase = ultima
      ? `Latência na última janela: mediana ${ultima.medianaMs} ms, p95 ${ultima.p95Ms} ms.`
      : 'Latência: sem dados.';
    tela.setAttribute('aria-label', frase);
  }

  return { elemento, actualizar, mudarTema };
}

function configuracao(cores) {
  const opcoes = opcoesBase(cores);
  opcoes.interaction = { mode: 'index', intersect: false };
  opcoes.scales.y.ticks.callback = (valor) => `${valor} ms`;
  opcoes.scales.x.ticks.maxTicksLimit = 6;
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Mediana',
          data: [],
          borderColor: cores.primaria,
          backgroundColor: cores.primariaSuave,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'p95',
          data: [],
          borderColor: cores.aviso,
          borderDash: [6, 4],
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: opcoes,
  };
}
