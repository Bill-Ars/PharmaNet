# FarmaRede — frontend

Site estático (HTML, CSS e JavaScript simples, sem passo de build) que torna visível o
comportamento distribuído do FarmaRede: pesquisa nas três farmácias, origem de cada resposta
(líder, réplica ou indisponível), gestão de stock no nó líder e painel em tempo real.

Protótipo académico — Sistemas Distribuídos e Paralelos, ISUTC (Maputo).

## Páginas

| Ficheiro      | Página                    | Quem vê                                 |
| ------------- | ------------------------- | --------------------------------------- |
| `index.html`  | Pesquisa                  | Todos                                   |
| `login.html`  | Entrar                    | Todos                                   |
| `gestao.html` | Gestão de stock           | Operadores autenticados                 |
| `painel.html` | Painel em tempo real      | Todos (controlo de falhas só com admin) |
| `guia.html`   | Guia de estilo            | Só desenvolvimento (fora do menu)       |

## Como correr localmente

Não há nada para instalar. Basta um servidor estático (os módulos ES não funcionam abrindo o
ficheiro directamente com `file://`):

- **VS Code:** botão direito em `frontend/index.html` → *Open with Live Server*; ou
- **Terminal**, na raiz do projecto: `npx serve frontend` e abrir o endereço indicado.

Enquanto `USAR_SIMULADOR = true` em `js/config/config.js`, o site funciona sem backend.

## Arquitectura em camadas

```text
            ┌───────────────────────────────┐
  1         │  Páginas      js/paginas/     │  ponto de entrada de cada página
            └──────┬─────────────────┬──────┘
                   ▼                 ▼
            ┌─────────────┐   ┌──────────────┐
  2 / 3     │ Componentes │   │  Serviços    │
            │ componentes/│   │  servicos/   │
            └──────┬──────┘   └──────┬───────┘
                   ▼                 ▼
            ┌───────────────────────────────┐
  4         │  Base   config/ + utilitarios/│
            └───────────────────────────────┘
```

| Camada         | Pasta                                | Faz                                                     | Não pode                                          |
| -------------- | ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| 1. Páginas     | `js/paginas/`                        | Lê o estado inicial, liga eventos, chama serviços e componentes | Ser importada por outro ficheiro            |
| 2. Componentes | `js/componentes/`                    | Recebe dados e devolve um `HTMLElement` pronto          | Fazer `fetch`, ler o `sessionStorage`, saber URLs |
| 3. Serviços    | `js/servicos/`                       | Fala com o backend (ou o simulador) e guarda a sessão   | Tocar no DOM                                      |
| 4. Base        | `js/config/`, `js/utilitarios/`      | Configuração e funções genéricas                        | Conhecer páginas, componentes ou serviços         |

Regras:

1. **As dependências só descem** (páginas → componentes / serviços → base), nunca em ciclo.
2. **Só `servicos/api.js` faz `fetch`.**
3. **Os componentes são funções puras de desenho.** As acções chegam como funções no
   segundo argumento, por exemplo `navegacao(dados, { aoAlternarTema })`.
4. **Um ficheiro, uma responsabilidade.**
5. **O estado de cada página vive num só objecto** (`const estado = { … }`) no ficheiro da página.
6. **Nunca `innerHTML` com dados de fora:** usa-se `criar()` de `utilitarios/dom.js`.

### Utilitários (camada base)

| Ficheiro       | Para que serve                                                              |
| -------------- | --------------------------------------------------------------------------- |
| `dom.js`       | `criar()`, `acrescentar()`, `limpar()`, `$()`, `$$()`, `marcarRolagem()`    |
| `icones.js`    | `icone('nome')` devolve um `<svg>` (desenhos do Lucide, licença ISC)        |
| `animar.js`    | `entradaEscalonada()`, `contarAte()`, `animarUmaVez()`, movimento reduzido  |
| `tema.js`      | Modo claro/escuro: `alternarTema()`, `temaActual()`, `lerToken()`           |
| `formatar.js`  | Tempos, horas, números e `normalizar()` (texto sem acentos)                 |
| `graficos.js`  | Cores e opções comuns aos gráficos do painel (Chart.js)                     |

### Como uma página arranca

Cada HTML tem um lugar reservado `<div id="navegacao">` (para a página não «saltar») e carrega
um só script de entrada:

```html
<script type="module" src="js/paginas/pesquisa.js"></script>
```

Esse lugar já traz a marca «FarmaRede» escrita no HTML, para aparecer antes do JavaScript.
O script da página desenha o cabeçalho completo com o componente e põe-no nesse lugar:

```js
const cabecalho = navegacao(
  { paginaActual: 'pesquisa', tema: temaActual(), sessao: lerSessao() },
  { aoAlternarTema: alternarTema, aoSair: sair },
);
$('#navegacao').replaceWith(cabecalho);
```

O mesmo menu é **barra inferior** no telemóvel (< 768 px) e **menu de topo** no resto —
a diferença está só em `css/layout/navegacao.css`.

## CSS

`css/main.css` declara a ordem das camadas de cascata e importa cada ficheiro para a sua:

```css
@layer reset, tokens, base, layout, componentes, paginas, utilitarios;
```

O CSS **de cada página** (`css/paginas/*.css`) não é importado pelo `main.css`: cada HTML liga
só o seu, logo a seguir ao `main.css`, e esse ficheiro põe as regras em `@layer paginas { … }`.
Assim nenhuma página descarrega o CSS das outras.

- **Tipo de letra:** Plus Jakarta Sans (Google Fonts, licença SIL OFL — `fonts/OFL.txt`),
  alojada no próprio site num só ficheiro variável (`fonts/plus-jakarta-sans-latin.woff2`),
  com `font-display: swap` e pré-carregada no `<head>`. Vir do nosso domínio poupa duas
  ligações externas e foi o que levou o Lighthouse acima de 90 em todas as páginas.
- **Tokens** (`base/tokens.css`): todas as cores, espaços, tipos de letra, raios, sombras e
  durações. Nenhum outro ficheiro escreve estes valores à mão. O modo escuro redefine as cores
  em `:root[data-tema='escuro']`.
- **Estados com cor fixa:** qualquer elemento com `data-estado` recebe `--cor-estado`:
  verde (vivo, disponível, líder), âmbar (réplica, lento), cinzento (indisponível),
  vermelho (sem stock, erro, conflito). A cor vem sempre acompanhada de texto.
- **Nomes BEM em português:** `.cartao-farmacia`, `.cartao-farmacia__titulo`,
  `.cartao-farmacia--esqueleto`.
- **Mobile-first:** pontos de quebra 768 px (tablet), 1024 px (portátil).
- **Movimento:** só `transform` e `opacity`; com «reduzir movimento» não há ciclos nem
  deslocamentos (`utilitarios/animacoes.css`).
- **Transições entre páginas:** View Transitions API (`@view-transition` em `main.css`); os
  navegadores sem suporte mudam de página normalmente.

## Qualidade (Fase 9)

Medido com o Lighthouse 12 em **modo telemóvel** (4G lento simulado, CPU 4× mais lenta), num
servidor local com HTTPS + HTTP/2 + gzip, como a Render:

| Página      | Performance | Acessibilidade | Boas práticas | SEO |
| ----------- | ----------- | -------------- | ------------- | --- |
| Pesquisa    | 100         | 100            | 100           | 100 |
| Login       | 100         | 100            | 100           | 100 |
| Gestão      | 99          | 100            | 100           | 100 |
| Painel      | 100         | 100            | 100           | 100 |

Também verificado:

- **Larguras** 320, 360, 390, 768, 1024 e 1440 px e telemóvel deitado (740 × 360): nenhuma
  rolagem horizontal, nas cinco páginas, no Chrome e no Edge.
- **Modo escuro:** acessibilidade 100 nas quatro páginas; todos os pares texto/fundo dos
  tokens com contraste ≥ 4,5:1 e contornos de campos ≥ 3:1, nos dois temas.
- **Reduzir movimento:** sem pulsar nem brilho; entradas só com desvanecimento; números sem contagem.
- **Consola:** sem erros.

Para repetir a medição: abrir o site no Chrome → F12 → separador *Lighthouse* → *Mobile* →
*Analyze page load*. Num servidor sem compressão nem HTTP/2 (ex.: Live Server) a Performance
desce (os 20 ficheiros de CSS e JS demoram mais a chegar); na Render os números são os de cima.

Ainda por testar à mão: **Firefox e Safari** (não instalados neste computador) e a navegação
completa só com **teclado** num navegador real (Tab, Shift+Tab, Enter, Esc, setas nos
controlos segmentados).

## Publicação na Render

Detalhes completos na Fase 10. Resumo:

- Tipo: **Static Site** · Root directory: `frontend` · Build command: vazio · Publish directory: `.`
- Pôr os endereços reais dos serviços em `js/config/config.js` e `USAR_SIMULADOR = false`.
- O backend tem de permitir CORS para o endereço do site.
