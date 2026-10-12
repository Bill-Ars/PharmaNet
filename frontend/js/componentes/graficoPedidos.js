/*
 * graficoPedidos.js — camada de componentes.
 * Gráfico de barras «Pedidos por nó» na última janela de 5 s (Chart.js).
 * Cada barra tem a cor do estado do nó: principal (vivo), âmbar (lento), cinzento (indisponível).
 * Devolve { elemento, actualizar(dados), mudarTema() }: o gráfico é criado uma vez
 * e depois só os números mudam, com a animação do próprio Chart.js.
 * Usado por paginas/painel.js.
 */
import { criar } from '../utilitarios/dom.js';
import { bibliotecaDisponivel, coresDosGraficos, opcoesBase } from '../utilitarios/graficos.js';

export function graficoPedidos() {
  const tela = criar('canvas', { role: 'img', 'aria-label': 'Pedidos por nó: à espera dos primeiros dados.' });
  const elemento = criar('div', { classe: 'grafico' }, tela);
  if (!bibliotecaDisponivel()) return graficoIndisponivel(elemento);

  let grafico = null;
  let ultimosDados = [];

  /** @param {Array<{no:string, pedidos:number, estado:string}>} dados */
  function actualizar(dados) {
    ultimosDados = dados;
    const cores = coresDosGraficos();
    // Só se cria quando já está na página (o Chart.js precisa do tamanho do contentor).
    grafico ??= new window.Chart(tela, configuracao(cores));
    grafico.data.labels = dados.map((linha) => `Nó ${linha.no}`);
    grafico.data.datasets[0].data = dados.map((linha) => linha.pedidos);
    grafico.data.datasets[0].backgroundColor = dados.map((linha) => corDoEstado(linha.estado, cores));
    grafico.update();
    tela.setAttribute('aria-label', `Pedidos por nó na última janela: ${dados.map((l) => `nó ${l.no}, ${l.pedidos}`).join('; ')}.`);
  }

  // As cores vêm dos tokens: ao mudar de tema volta-se a configurar com as novas.
  function mudarTema() {
    if (!grafico) return;
    grafico.destroy();
    grafico = null;
    actualizar(ultimosDados);
  }

  return { elemento, actualizar, mudarTema };
}

function configuracao(cores) {
  const opcoes = opcoesBase(cores);
  opcoes.plugins.legend.display = false;
  opcoes.scales.y.ticks.precision = 0; // pedidos são números inteiros
  return {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Pedidos', data: [], borderRadius: 8, maxBarThickness: 56 }] },
    options: opcoes,
  };
}

function corDoEstado(estado, cores) {
  if (estado === 'lento') return cores.aviso;
  if (estado === 'indisponivel') return cores.neutra;
  return cores.primaria;
}

// Sem Chart.js (CDN em baixo): uma frase em vez do gráfico, nunca uma zona em branco.
function graficoIndisponivel(elemento) {
  elemento.replaceChildren(criar('p', { classe: 'grafico__sem-biblioteca', texto: 'Não foi possível carregar o gráfico.' }));
  return { elemento, actualizar() {}, mudarTema() {} };
}
