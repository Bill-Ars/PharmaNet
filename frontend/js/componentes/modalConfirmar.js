/*
 * modalConfirmar.js — camada de componentes.
 * Caixa de confirmação para acções que não se desfazem (ex.: «Repor dados de demonstração»).
 * Usa o <dialog> nativo com showModal(): o foco fica preso lá dentro, o resto da página
 * fica inerte e Esc fecha. Um clique no fundo escuro também fecha (= cancelar).
 * Devolve uma Promise com true (confirmou) ou false. Usado por paginas/painel.js.
 */
import { criar } from '../utilitarios/dom.js';
import { icone } from '../utilitarios/icones.js';

/**
 * @param {object} dados titulo, texto, rotuloConfirmar, icone
 * @returns {Promise<boolean>}
 */
export function modalConfirmar({ titulo, texto, rotuloConfirmar = 'Confirmar', icone: nomeIcone = 'alerta' }) {
  const focoAnterior = document.activeElement;
  const dialogo = criar('dialog', { classe: 'modal', 'aria-labelledby': 'modal-titulo', 'aria-describedby': 'modal-texto' }, [
    criar('form', { method: 'dialog', classe: 'modal__caixa' }, [
      criar('span', { classe: 'modal__icone' }, icone(nomeIcone, { tamanho: 24 })),
      criar('h2', { classe: 'modal__titulo', id: 'modal-titulo', texto: titulo }),
      criar('p', { classe: 'modal__texto', id: 'modal-texto', texto }),
      criar('div', { classe: 'modal__accoes' }, [
        // O foco começa em «Cancelar»: a opção segura.
        criar('button', { type: 'submit', value: 'cancelar', classe: ['botao', 'botao--secundario'], autofocus: true, texto: 'Cancelar' }),
        criar('button', { type: 'submit', value: 'confirmar', classe: ['botao', 'botao--perigo'], texto: rotuloConfirmar }),
      ]),
    ]),
  ]);

  return new Promise((resolver) => {
    // Pode ser chamada por vários caminhos (botão, Esc, clique fora, evento close): só conta a primeira.
    let terminado = false;
    function terminar(confirmou) {
      if (terminado) return;
      terminado = true;
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      focoAnterior?.focus?.(); // o foco volta ao botão que abriu o modal
      resolver(confirmou);
    }

    dialogo.querySelector('form').addEventListener('submit', (evento) => {
      evento.preventDefault();
      terminar(evento.submitter?.value === 'confirmar');
    });
    dialogo.addEventListener('cancel', (evento) => {
      evento.preventDefault(); // Esc
      terminar(false);
    });
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) terminar(false); // clique no fundo escuro
    });
    dialogo.addEventListener('close', () => terminar(dialogo.returnValue === 'confirmar'));

    document.body.append(dialogo);
    dialogo.showModal();
  });
}
