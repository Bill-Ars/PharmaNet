/*
 * icones.js — camada base (utilitários).
 * Ícones SVG inline. Os desenhos são copiados do Lucide (https://lucide.dev, licença ISC).
 * Como são constantes do projecto, e não dados de fora, podem ser inseridos como marcação.
 * Usado por componentes e páginas: icone('pesquisa') devolve um <svg> pronto.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Cada desenho é o conteúdo de um <svg viewBox="0 0 24 24"> do Lucide.
const DESENHOS = {
  pesquisa: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  certo: '<path d="M20 6 9 17l-5-5"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  circuloCerto: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  circuloX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  recarregar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  repor: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  menos: '<path d="M5 12h14"/>',
  editar: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  olho: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  entrar: '<path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
  sair: '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  caixa: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  actividade: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  servidor: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
  utilizador: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cadeado: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  comprimido: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  copia: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  coroa: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  semLigacao: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cruz: '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z"/>',
  desligar: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  painel: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
};

// Ilustrações dos estados vazios (desenho do projecto, não do Lucide), viewBox 0 0 120 120.
const ILUSTRACOES = {
  pesquisaVazia:
    '<circle class="ilustracao__fundo" cx="60" cy="60" r="54"/>' +
    '<g transform="rotate(-35 50 56)"><rect class="ilustracao__peca" x="26" y="45" width="48" height="22" rx="11" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M50 45v22" stroke="currentColor" stroke-width="3"/></g>' +
    '<circle class="ilustracao__peca" cx="76" cy="70" r="15" stroke="currentColor" stroke-width="4"/>' +
    '<path d="m87 81 11 11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
};

/**
 * Cria um ícone SVG.
 * @param {string} nome    chave de DESENHOS, ex.: 'pesquisa'
 * @param {object} opcoes  tamanho em px (20), rotulo para leitores de ecrã, classe extra
 * @returns {SVGSVGElement}
 */
export function icone(nome, { tamanho = 20, rotulo = '', classe = '' } = {}) {
  const desenho = DESENHOS[nome];
  if (!desenho) console.warn(`Ícone desconhecido: «${nome}»`);

  const svg = criarSvg('0 0 24 24', tamanho, desenho ?? '');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `icone ${classe}`.trim());
  descrever(svg, rotulo);
  return svg;
}

/** Cria uma das ilustrações grandes dos estados vazios. */
export function ilustracao(nome, { classe = '' } = {}) {
  const svg = criarSvg('0 0 120 120', 120, ILUSTRACOES[nome] ?? '');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('class', classe);
  descrever(svg, '');
  return svg;
}

/**
 * Troca cada <span data-icone="nome"> dentro de `raiz` pelo ícone verdadeiro.
 * Permite escrever ícones directamente no HTML das páginas.
 */
export function preencherIcones(raiz = document) {
  for (const marcador of raiz.querySelectorAll('[data-icone]')) {
    const svg = icone(marcador.dataset.icone, {
      tamanho: Number(marcador.dataset.tamanho) || 20,
      rotulo: marcador.getAttribute('aria-label') ?? '',
      classe: marcador.className,
    });
    marcador.replaceWith(svg);
  }
}

function criarSvg(caixa, tamanho, conteudo) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', caixa);
  svg.setAttribute('width', String(tamanho));
  svg.setAttribute('height', String(tamanho));
  svg.innerHTML = conteudo; // seguro: só constantes deste ficheiro
  return svg;
}

// Ícone com rótulo é lido pelo leitor de ecrã; sem rótulo é decorativo e fica escondido.
function descrever(svg, rotulo) {
  if (rotulo) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', rotulo);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  svg.setAttribute('focusable', 'false');
}
