/*
 * animar.js — camada base (utilitários).
 * Ajudas de movimento: entrada em cascata, contagem de números e animações de uma só vez.
 * Antes de animar, verifica se a pessoa pediu ao sistema para reduzir o movimento.
 * Usado por páginas (e pelo guia de estilo).
 */

const consultaMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

/** true quando o sistema pede menos movimento. */
export function movimentoReduzido() {
  return consultaMovimento.matches;
}

/**
 * Lê uma duração dos tokens CSS (ex.: '--duracao-lenta' → 400) em milissegundos.
 * Assim o JavaScript usa os mesmos tempos que o CSS, sem números repetidos.
 */
export function lerDuracao(nomeToken) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nomeToken).trim();
  const numero = parseFloat(valor);
  if (Number.isNaN(numero)) return 0;
  return valor.endsWith('ms') ? numero : numero * 1000;
}

/**
 * Faz os elementos entrarem um a seguir ao outro (aparecer + subir 8 px).
 * Cada um espera mais `--intervalo-cascata` (60 ms) do que o anterior.
 */
export function entradaEscalonada(elementos) {
  const intervalo = movimentoReduzido() ? 0 : lerDuracao('--intervalo-cascata');
  [...elementos].forEach((elemento, posicao) => {
    elemento.style.setProperty('--atraso', `${posicao * intervalo}ms`);
    reiniciarClasse(elemento, 'anim-entrar');
  });
}

/**
 * Aplica uma classe de animação uma única vez (ex.: 'anim-abanar')
 * e retira-a quando acaba, para poder ser repetida mais tarde.
 */
export function animarUmaVez(elemento, classe) {
  reiniciarClasse(elemento, classe);
  // Espera pelo fim de todas as animações que a classe começou (também as de ::before e
  // ::after), ignorando as que se repetem sem fim (ex.: o ponto «vivo» a pulsar).
  const animacoes = elemento
    .getAnimations({ subtree: true })
    .filter((animacao) => animacao.effect?.getTiming().iterations !== Infinity);
  const retirar = () => elemento.classList.remove(classe);
  Promise.allSettled(animacoes.map((animacao) => animacao.finished)).then(retirar);
  // Garantia: com o separador escondido as animações ficam em pausa e podem não «acabar».
  const maisLonga = Math.max(0, ...animacoes.map((animacao) => animacao.effect.getComputedTiming().endTime));
  setTimeout(retirar, maisLonga + 50);
}

// Tirar e voltar a pôr a mesma classe não reinicia a animação, a menos que o
// navegador recalcule o desenho entre os dois passos: ler offsetWidth força isso.
function reiniciarClasse(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
}

// Guarda a animação em curso de cada elemento, para uma nova contagem cancelar a anterior.
const contagensActivas = new WeakMap();

/**
 * Conta do valor anterior até ao novo valor (400 ms, a abrandar no fim).
 * O valor anterior fica guardado em data-valor no próprio elemento.
 * @param {HTMLElement} elemento
 * @param {number} valorFinal
 * @param {(numero:number)=>string} formatar como mostrar cada número intermédio
 */
export function contarAte(elemento, valorFinal, formatar = String) {
  const valorInicial = Number(elemento.dataset.valor ?? 0);
  elemento.dataset.valor = String(valorFinal);
  cancelAnimationFrame(contagensActivas.get(elemento));

  if (movimentoReduzido() || valorInicial === valorFinal) {
    elemento.textContent = formatar(valorFinal);
    return;
  }

  const duracao = lerDuracao('--duracao-lenta');
  const inicio = performance.now();

  function passo(agora) {
    // Entre 0 e 1: o tempo do frame pode ser ligeiramente anterior ao início da contagem.
    const progresso = Math.min(Math.max((agora - inicio) / duracao, 0), 1);
    const suavizado = 1 - (1 - progresso) ** 3; // começa depressa e abranda no fim
    const atual = Math.round(valorInicial + (valorFinal - valorInicial) * suavizado);
    elemento.textContent = formatar(atual);
    if (progresso < 1) contagensActivas.set(elemento, requestAnimationFrame(passo));
  }

  contagensActivas.set(elemento, requestAnimationFrame(passo));
  // Garantia: num separador escondido o navegador não desenha frames; o número certo aparece na mesma.
  setTimeout(() => {
    if (elemento.dataset.valor === String(valorFinal)) elemento.textContent = formatar(valorFinal);
  }, duracao + 50);
}
