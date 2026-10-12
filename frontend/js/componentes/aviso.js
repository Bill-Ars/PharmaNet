/*
 * aviso.js — camada de componentes.
 * Três formas de mostrar uma mensagem:
 *   aviso()              → caixa dentro da página (com botão de acção opcional)
 *   mostrarNotificacao() → mensagem flutuante que fecha sozinha ao fim de 4 s
 *   estadoVazio()        → ilustração + frase útil quando não há nada para mostrar
 * Usado pelas páginas. Nunca recebe HTML: todo o texto entra como texto.
 */
import { $, criar } from '../utilitarios/dom.js';
import { icone, ilustracao } from '../utilitarios/icones.js';
import { lerDuracao } from '../utilitarios/animar.js';

const ICONE_DO_TIPO = { info: 'info', sucesso: 'circuloCerto', aviso: 'alerta', erro: 'alerta' };

/**
 * Caixa de aviso dentro da página.
 * @param {object} dados  tipo ('info'|'sucesso'|'aviso'|'erro'), titulo, texto, icone (opcional)
 * @param {object} accoes accao: { rotulo, icone, aoClicar } para um botão (opcional)
 * @returns {HTMLElement}
 */
export function aviso({ tipo = 'info', titulo, texto, icone: nomeIcone }, { accao } = {}) {
  return criar('div', { classe: ['aviso', tipo !== 'info' && `aviso--${tipo}`] }, [
    criar('span', { classe: 'aviso__icone' }, icone(nomeIcone ?? ICONE_DO_TIPO[tipo])),
    criar('div', { classe: 'aviso__corpo' }, [
      titulo && criar('p', { classe: 'aviso__titulo', texto: titulo }),
      texto && criar('p', { classe: 'aviso__texto', texto }),
      accao && criar('div', { classe: 'aviso__accoes' }, botaoDeAccao(accao)),
    ]),
  ]);
}

function botaoDeAccao({ rotulo, icone: nomeIcone, aoClicar }) {
  return criar('button', { type: 'button', classe: ['botao', 'botao--secundario', 'botao--pequeno'], onclick: aoClicar }, [
    nomeIcone && icone(nomeIcone, { tamanho: 16 }),
    rotulo,
  ]);
}

/**
 * Estado vazio desenhado (nunca deixar a página em branco).
 * @param {object} dados titulo, texto, ilustracao (nome em icones.js)
 */
export function estadoVazio({ titulo, texto, ilustracao: nomeIlustracao = 'pesquisaVazia' }) {
  return criar('div', { classe: ['cartao', 'estado-vazio'] }, [
    ilustracao(nomeIlustracao, { classe: 'estado-vazio__ilustracao' }),
    criar('p', { classe: 'estado-vazio__titulo', texto: titulo }),
    texto && criar('p', { classe: 'estado-vazio__texto', texto }),
  ]);
}

/* ---------------- Notificações flutuantes ---------------- */

const ICONE_DA_NOTIFICACAO = { sucesso: 'certo', erro: 'fechar', info: 'info' };

/** Desenha uma notificação (sem a mostrar). */
export function notificacao({ texto, tipo = 'info' }, { aoFechar }) {
  return criar('div', { classe: ['notificacao', `notificacao--${tipo}`] }, [
    criar('span', { classe: 'notificacao__icone' }, icone(ICONE_DA_NOTIFICACAO[tipo], { tamanho: 16 })),
    criar('p', { classe: 'notificacao__texto', texto }),
    criar(
      'button',
      { type: 'button', classe: 'notificacao__fechar', 'aria-label': 'Fechar notificação', onclick: aoFechar },
      icone('fechar', { tamanho: 18 }),
    ),
  ]);
}

/**
 * Mostra uma notificação na zona #notificacoes da página e fecha-a ao fim de 4 s.
 * A zona tem aria-live, por isso o leitor de ecrã lê a mensagem.
 */
export function mostrarNotificacao(texto, tipo = 'info') {
  const elemento = notificacao({ texto, tipo }, { aoFechar: () => fecharNotificacao(elemento) });
  $('#notificacoes').append(elemento);
  setTimeout(() => fecharNotificacao(elemento), lerDuracao('--duracao-notificacao'));
}

function fecharNotificacao(elemento) {
  if (!elemento.isConnected) return;
  elemento.classList.add('notificacao--a-sair');
  elemento.addEventListener('animationend', () => elemento.remove(), { once: true });
  // Garante que sai mesmo que a animação não corra (separador escondido, por exemplo).
  setTimeout(() => elemento.remove(), lerDuracao('--duracao-normal') + 50);
}
