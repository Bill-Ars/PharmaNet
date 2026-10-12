/*
 * cartaoFarmacia.js — camada de componentes.
 * Cartão com o resultado de uma farmácia na pesquisa: estado (disponível, sem stock,
 * não foi possível consultar) e a «rota» que mostra que nó respondeu (líder → réplica).
 * Usado por paginas/pesquisa.js. Recebe dados; não sabe nada de pedidos nem de endereços.
 */
import { criar } from '../utilitarios/dom.js';
import { doisDigitos } from '../utilitarios/formatar.js';
import { etiquetaOrigem } from './etiquetaOrigem.js';

const TEXTO_DO_ESTADO = {
  disponivel: 'Disponível',
  'sem-stock': 'Sem stock',
  // Nunca «sem stock»: não sabemos, porque nenhum nó respondeu.
  indisponivel: 'Não foi possível consultar',
};

/**
 * @param {object} dados
 * @param {{id:number, nome:string, disponivel:boolean|null, origem:string}} dados.farmacia
 * @param {{nome:string, dosagem:string}} dados.medicamento
 * @param {{lider:string, replica:string}} dados.rota  nós líder e réplica desta farmácia
 * @returns {HTMLElement}
 */
export function cartaoFarmacia({ farmacia, medicamento, rota }) {
  const estado = estadoDe(farmacia);
  return criar('article', { classe: ['cartao', 'cartao-farmacia'], dados: { estado, origem: farmacia.origem } }, [
    criar('header', { classe: 'cartao-farmacia__cabecalho' }, [
      criar('div', {}, [
        criar('p', { classe: 'cartao-farmacia__sobretitulo', texto: `${medicamento.nome} ${medicamento.dosagem}` }),
        criar('h3', { classe: 'cartao-farmacia__titulo', texto: farmacia.nome }),
      ]),
      criar('span', { classe: 'cartao-farmacia__indice', 'aria-hidden': 'true', texto: doisDigitos(farmacia.id) }),
    ]),
    criar('p', { classe: 'cartao-farmacia__estado' }, [criar('span', { classe: 'indicador' }), TEXTO_DO_ESTADO[estado]]),
    criar('footer', { classe: 'cartao-farmacia__rodape' }, [
      desenharRota(farmacia.origem, rota),
      etiquetaOrigem(farmacia.origem),
    ]),
  ]);
}

function estadoDe(farmacia) {
  if (farmacia.origem === 'indisponivel') return 'indisponivel';
  return farmacia.disponivel ? 'disponivel' : 'sem-stock';
}

/*
 * A rota tem dois nós ligados: o líder e a réplica da farmácia.
 *   lider        → líder cheio a verde; réplica não foi precisa.
 *   replica      → líder falhou (tracejado); ligação cheia; réplica cheia a âmbar.
 *   indisponivel → os dois falharam.
 */
function desenharRota(origem, { lider, replica }) {
  const papelLider = origem === 'lider' ? 'respondeu' : 'falhou';
  const papelReplica = { lider: null, replica: 'respondeu', indisponivel: 'falhou' }[origem];

  return criar('div', { classe: 'rota', role: 'img', 'aria-label': descreverRota(origem, lider, replica) }, [
    criar('span', { classe: 'rota__rotulo', texto: 'Rota' }),
    criar('span', { classe: 'rota__no', dados: dadosDoNo('lider', papelLider), texto: lider }),
    criar('span', { classe: ['rota__ligacao', origem === 'replica' && 'rota__ligacao--percorrida'] }),
    criar('span', { classe: 'rota__no', dados: dadosDoNo('replica', papelReplica), texto: replica }),
  ]);
}

// Só o nó que respondeu leva cor (data-estado); o papel decide o desenho.
function dadosDoNo(tipo, papel) {
  if (!papel) return {};
  return papel === 'respondeu' ? { estado: tipo, papel } : { papel };
}

function descreverRota(origem, lider, replica) {
  if (origem === 'lider') return `Respondeu o líder, nó ${lider}`;
  if (origem === 'replica') return `O líder, nó ${lider}, não respondeu; respondeu a réplica, nó ${replica}`;
  return `Nem o líder, nó ${lider}, nem a réplica, nó ${replica}, responderam`;
}
