/*
 * login.js — camada de páginas (ponto de entrada de login.html).
 * Valida os campos, pede a entrada ao balanceador (via api.js) e trata a resposta:
 *   200 → guarda a sessão e volta à página de «?voltar=» (ou gestão / painel)
 *   401 → «Utilizador ou palavra-passe errados.» e o cartão abana uma vez
 *   429 → «Demasiadas tentativas…» e o botão fica bloqueado com contagem decrescente
 */
import { USAR_SIMULADOR } from '../config/config.js';
import { aviso } from '../componentes/aviso.js';
import { actualizarBotaoTema, navegacao } from '../componentes/navegacao.js';
import { entrar } from '../servicos/api.js';
import { destinoDepoisDeEntrar, guardarSessao, lerSessao, sair, substituirPagina } from '../servicos/sessao.js';
import { animarUmaVez } from '../utilitarios/animar.js';
import { $, criar, limpar, marcarRolagem, substituir } from '../utilitarios/dom.js';
import { icone, preencherIcones } from '../utilitarios/icones.js';
import { alternarTema, iniciarTema, temaActual } from '../utilitarios/tema.js';

const NOME_DA_PAGINA = { 'gestao.html': 'a gestão de stock', 'painel.html': 'o painel' };

// Todo o estado da página num só objecto.
const estado = {
  aEntrar: false,
  temporizadorBloqueio: null,
  voltar: new URLSearchParams(location.search).get('voltar'),
};

function iniciar() {
  // Quem já tem sessão não precisa de entrar outra vez.
  const sessao = lerSessao();
  if (sessao) {
    substituirPagina(destinoDepoisDeEntrar(sessao, estado.voltar));
    return;
  }
  montarNavegacao();
  preencherIcones();
  mostrarMotivo(new URLSearchParams(location.search).get('motivo'));
  $('#nota-simulador').hidden = !USAR_SIMULADOR;
  $('#formulario-login').addEventListener('submit', aoSubmeter);
  $('#mostrar-palavra').addEventListener('click', alternarPalavraPasse);
}

function montarNavegacao() {
  const cabecalho = navegacao(
    { paginaActual: 'login', tema: temaActual(), sessao: null },
    { aoAlternarTema: alternarTema, aoSair: sair },
  );
  $('#navegacao').replaceWith(cabecalho);
  marcarRolagem(cabecalho);
  iniciarTema();
  document.addEventListener('tema-mudou', (evento) => actualizarBotaoTema(cabecalho, evento.detail.tema));
}

// Explica porque é que a pessoa veio parar ao login.
function mostrarMotivo(motivo) {
  if (motivo === 'expirou') {
    mostrarAviso({ tipo: 'aviso', icone: 'relogio', titulo: 'A sessão terminou. Entre de novo para continuar.' });
  } else if (NOME_DA_PAGINA[estado.voltar]) {
    mostrarAviso({ tipo: 'info', icone: 'cadeado', titulo: `Entre para abrir ${NOME_DA_PAGINA[estado.voltar]}.` });
  }
}

/* ---------------- Entrada ---------------- */

async function aoSubmeter(evento) {
  evento.preventDefault();
  if (estado.aEntrar || !validarCampos()) return;

  // O nome não distingue maiúsculas («Operador1» = «operador1»); a palavra-passe sim.
  const utilizador = $('#utilizador').value.trim().toLowerCase();
  definirAEntrar(true);
  const resposta = await entrar(utilizador, $('#palavra-passe').value);
  definirAEntrar(false);
  tratarResposta(resposta, utilizador);
}

function tratarResposta({ estado: codigo, dados }, utilizador) {
  if (codigo === 200) {
    guardarSessao({ ...dados, utilizador });
    substituirPagina(destinoDepoisDeEntrar(dados, estado.voltar));
  } else if (codigo === 401) {
    mostrarAviso({ tipo: 'erro', icone: 'circuloX', titulo: 'Utilizador ou palavra-passe errados.' });
    animarUmaVez($('#cartao-login'), 'anim-abanar');
    $('#palavra-passe').value = '';
    $('#palavra-passe').focus();
  } else if (codigo === 429) {
    mostrarAviso({ tipo: 'erro', icone: 'relogio', titulo: 'Demasiadas tentativas. Tente de novo dentro de 1 minuto.' });
    bloquear(dados?.tentarDentroDe ?? 60);
  } else {
    mostrarAviso({ tipo: 'erro', icone: 'semLigacao', titulo: 'Não foi possível entrar agora. Tente de novo.' });
  }
}

function definirAEntrar(aEntrar) {
  estado.aEntrar = aEntrar;
  const botao = $('#botao-entrar');
  if (aEntrar) {
    limpar($('#zona-avisos'));
    botao.setAttribute('aria-busy', 'true');
  } else {
    botao.removeAttribute('aria-busy');
  }
}

/* ---------------- Bloqueio após 429 ---------------- */

function bloquear(segundos) {
  let restantes = segundos;
  const botao = $('#botao-entrar');
  botao.disabled = true;
  desenharBotao(`Tente dentro de ${restantes} s`);

  clearInterval(estado.temporizadorBloqueio);
  estado.temporizadorBloqueio = setInterval(() => {
    restantes -= 1;
    if (restantes > 0) {
      desenharBotao(`Tente dentro de ${restantes} s`);
      return;
    }
    clearInterval(estado.temporizadorBloqueio);
    botao.disabled = false;
    desenharBotao('Entrar');
  }, 1000);
}

function desenharBotao(texto) {
  substituir($('#botao-entrar'), [icone(texto === 'Entrar' ? 'entrar' : 'relogio'), texto]);
}

/* ---------------- Validação dos campos ---------------- */

function validarCampos() {
  const utilizadorValido = validarCampo($('#utilizador'), 'Escreva o seu utilizador.');
  const palavraValida = validarCampo($('#palavra-passe'), 'Escreva a palavra-passe.');
  // O foco vai para o primeiro campo com erro.
  if (!utilizadorValido) $('#utilizador').focus();
  else if (!palavraValida) $('#palavra-passe').focus();
  return utilizadorValido && palavraValida;
}

function validarCampo(entrada, mensagem) {
  const campo = entrada.closest('.campo');
  campo.querySelector('.campo__erro')?.remove();
  if (entrada.value.trim() !== '') {
    entrada.removeAttribute('aria-invalid');
    entrada.removeAttribute('aria-describedby');
    return true;
  }
  const idErro = `${entrada.id}-erro`;
  campo.append(criar('p', { classe: 'campo__erro', id: idErro }, [icone('circuloX', { tamanho: 16 }), mensagem]));
  entrada.setAttribute('aria-invalid', 'true');
  entrada.setAttribute('aria-describedby', idErro);
  return false;
}

/* ---------------- Pequenas ajudas ---------------- */

function mostrarAviso(dados) {
  substituir($('#zona-avisos'), aviso(dados));
}

function alternarPalavraPasse(evento) {
  const botao = evento.currentTarget;
  const campo = $('#palavra-passe');
  const mostrar = campo.type === 'password';
  campo.type = mostrar ? 'text' : 'password';
  botao.setAttribute('aria-pressed', String(mostrar));
  botao.setAttribute('aria-label', mostrar ? 'Esconder palavra-passe' : 'Mostrar palavra-passe');
  substituir(botao, icone(mostrar ? 'olhoFechado' : 'olho'));
}

iniciar();
