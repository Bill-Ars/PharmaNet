/*
 * sessao.js — camada de serviços.
 * Guarda a sessão (token, papel, farmácia, validade) no sessionStorage — nunca no
 * localStorage: fecha-se o separador e a sessão desaparece.
 * Protege as páginas reservadas e decide para onde ir depois de entrar.
 * Usado pelas páginas (login, gestão, painel). O api.js não o lê: as páginas passam-lhe o token.
 */

export const CHAVE_SESSAO = 'farmarede-sessao';

// Só estas páginas podem ser destino de «?voltar=»: evita redirecionar para sites de fora.
const PAGINAS_PERMITIDAS = ['index.html', 'gestao.html', 'painel.html'];

/** Guarda a resposta do login (mais o nome do utilizador). */
export function guardarSessao({ token, expiraEm, papel, farmaciaId, utilizador }) {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ token, expiraEm, papel, farmaciaId, utilizador }));
  } catch {
    // sem armazenamento: a sessão dura só até mudar de página
  }
}

/** A sessão actual, ou null se não existe ou já expirou (nesse caso é apagada). */
export function lerSessao() {
  const sessao = lerGuardada();
  if (!sessao) return null;
  if (expirou(sessao)) {
    terminarSessao();
    return null;
  }
  return sessao;
}

export function terminarSessao() {
  try {
    sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // nada a fazer
  }
}

/** Termina a sessão e volta à página inicial (botão «Sair» da navegação). */
export function sair() {
  terminarSessao();
  location.assign('index.html');
}

/**
 * Garante que há sessão (e, se pedido, com o papel certo).
 * Sem sessão: envia para login.html?voltar=<esta página> e devolve null.
 * @param {object} opcoes  papel: 'admin' para exigir administrador
 */
export function exigirSessao({ papel } = {}) {
  const tinhaSessao = lerGuardada() !== null;
  const sessao = lerSessao();
  if (sessao && (!papel || sessao.papel === papel)) return sessao;

  // «expirou» se havia sessão guardada que deixou de ser válida.
  const motivo = tinhaSessao && !sessao ? 'expirou' : 'entrar';
  irParaLogin(motivo);
  return null;
}

/** Envia para o login, lembrando a página actual para voltar depois. */
export function irParaLogin(motivo = 'entrar') {
  const voltar = paginaActual();
  substituirPagina(`login.html?voltar=${encodeURIComponent(voltar)}&motivo=${motivo}`);
}

/**
 * Muda de página sem deixar esta no histórico (o «Voltar» não regressa aqui).
 * Espera que a página actual seja desenhada uma vez: sair antes disso interrompe
 * a transição entre páginas e o navegador regista um erro na consola.
 */
export function substituirPagina(endereco) {
  let feito = false;
  const ir = () => {
    if (feito) return;
    feito = true;
    // Aviso lido pelo script do <head>: uma redirecção automática muda de página sem transição.
    try {
      sessionStorage.setItem('farmarede-sem-transicao', '1');
    } catch {
      // sem armazenamento: a transição acontece na mesma
    }
    location.replace(endereco);
  };
  requestAnimationFrame(() => setTimeout(ir, 0));
  // Garantia: se não houver frames (separador escondido, por exemplo), muda na mesma.
  setTimeout(ir, 500);
}

/** Minutos que faltam até a sessão expirar (arredondado para cima; nunca negativo). */
export function minutosRestantes(sessao) {
  const faltam = Date.parse(sessao.expiraEm) - Date.now();
  return Math.max(0, Math.ceil(faltam / 60000));
}

/**
 * Para onde ir depois de entrar: a página de «?voltar=» se for permitida;
 * senão a gestão (operador) ou o painel (admin).
 */
export function destinoDepoisDeEntrar(sessao, voltar) {
  if (PAGINAS_PERMITIDAS.includes(voltar)) return voltar;
  return sessao.papel === 'admin' ? 'painel.html' : 'gestao.html';
}

/* ---------------- Ajudas internas ---------------- */

function lerGuardada() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO));
  } catch {
    return null;
  }
}

function expirou(sessao) {
  return !sessao.token || !(Date.parse(sessao.expiraEm) > Date.now());
}

function paginaActual() {
  const nome = location.pathname.split('/').pop();
  return nome || 'index.html';
}
