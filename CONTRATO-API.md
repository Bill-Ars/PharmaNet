# FarmaRede — contrato da API (o que o frontend espera do backend)

Este documento descreve, rota a rota, o que o frontend envia e o que espera receber. O frontend
já está pronto e testado com um simulador que segue exactamente este contrato. Se o backend
fizer algo diferente, avisem: a adaptação faz-se num só ficheiro (`frontend/js/servicos/api.js`).

## 1. Serviços e endereços

| Serviço      | Local                   | Render (a confirmar)                    |
| ------------ | ----------------------- | --------------------------------------- |
| Balanceador  | `http://localhost:8080` | `https://farmarede-lb.onrender.com`     |
| Nó A         | `http://localhost:3001` | `https://farmarede-a.onrender.com`      |
| Nó B         | `http://localhost:3002` | `https://farmarede-b.onrender.com`      |
| Nó C         | `http://localhost:3003` | `https://farmarede-c.onrender.com`      |

Se os endereços ou as portas forem outros, digam: mudam só em `frontend/js/config/config.js`.

Líderes e réplicas (anel), que o frontend usa para saber a que nó pedir:

| Farmácia | Líder | Réplica guardada em |
| -------- | ----- | ------------------- |
| 1        | A     | B                   |
| 2        | B     | C                   |
| 3        | C     | A                   |

## 2. Regras gerais

- **JSON** em todos os pedidos e respostas (`Content-Type: application/json`).
- **CORS** nos 4 serviços, porque o site está noutro endereço:
  - `Access-Control-Allow-Origin`: **`https://pharmanet-olhw.onrender.com`** (o site publicado)
    e, para testes locais, `http://127.0.0.1:5501` (Live Server); ou `*` durante os testes;
  - `Access-Control-Allow-Headers: Content-Type, Authorization`;
  - `Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS`;
  - responder a `OPTIONS` com `204`: o navegador envia-o antes de cada `POST`/`PUT` com token.
- **Autenticação:** `Authorization: Bearer <token>`, com o token devolvido pelo login.
- **Erros:** corpo `{ "erro": "<codigo-curto>" }`. O frontend decide pelo **código HTTP**; o texto
  `erro` serve só para depuração.
- **Tempos limite do frontend:** 4 s nas rotas normais e 2 s nas do painel e de administração.
  Depois disso, o frontend trata o pedido como «sem resposta».
- **Primeiro pedido:** o frontend espera até **60 s** (serviços gratuitos da Render a acordar) e
  mostra «O servidor pode estar a arrancar…» aos 5 s.

## 3. Rotas públicas (via balanceador)

### `GET /v1/pesquisa?q=<texto>`

O balanceador entrega a um nó vivo (o **coordenador**), que pergunta às 3 farmácias em paralelo:
primeiro ao líder (limite 1,5 s) e, se falhar, à réplica.

```json
200
{
  "medicamento": { "id": 3, "nome": "Paracetamol", "dosagem": "500 mg", "apresentacao": "comprimidos" },
  "coordenador": "B",
  "tempoMs": 412,
  "farmacias": [
    { "id": 1, "nome": "Farmácia 1", "disponivel": true,  "origem": "lider" },
    { "id": 2, "nome": "Farmácia 2", "disponivel": false, "origem": "replica" },
    { "id": 3, "nome": "Farmácia 3", "disponivel": null,  "origem": "indisponivel" }
  ]
}
```

- `origem`: `"lider"`, `"replica"` ou `"indisponivel"`.
- Com `origem: "indisponivel"`, `disponivel` deve ser `null`. O frontend mostra «Não foi possível
  consultar» e **nunca** «Sem stock».
- **404** `{ "erro": "nao-encontrado" }` quando nenhum medicamento corresponde ao texto.
- **503** quando não há nenhum nó vivo.
- A pesquisa deve aceitar maiúsculas/minúsculas e acentos («ibuprofeno» = «Ibuprofêno»).

### `GET /v1/medicamentos`

```json
200
[ { "id": 3, "nome": "Paracetamol", "dosagem": "500 mg", "apresentacao": "comprimidos" } ]
```

Usado para as sugestões do campo de pesquisa. Se falhar, a página continua a funcionar.

### `POST /v1/login`

```json
pedido   { "utilizador": "operador1", "palavraPasse": "teste123" }
200      { "token": "…", "expiraEm": "2026-10-12T10:15:00Z", "papel": "operador", "farmaciaId": 1 }
```

- `papel`: `"operador"` (com `farmaciaId`) ou `"admin"` (com `farmaciaId: null`).
- `expiraEm` em ISO 8601 (UTC). O frontend mostra «Sessão expira em X min» e, aos 0, volta ao login.
- O frontend envia o **utilizador sempre em minúsculas e sem espaços**.
- **401** com credenciais erradas.
- **429** depois de demasiadas tentativas. O frontend aceita, opcionalmente,
  `{ "erro": "demasiadas-tentativas", "tentarDentroDe": 42 }`, em segundos, para a contagem
  decrescente; sem esse campo conta 60 s.

## 4. Stock (directamente ao nó LÍDER, nunca ao balanceador)

### `GET /v1/farmacias/:id/stock` → nó líder da farmácia

```json
200
{
  "farmaciaId": 1,
  "origem": "lider",
  "stock": [ { "medicamentoId": 3, "nome": "Paracetamol 500 mg", "quantidade": 12, "versao": 4 } ]
}
```

- `nome` já com a dosagem, porque é o que aparece na tabela.
- Se o líder estiver parado, o pedido não tem resposta e a página fica «só de leitura».
- O frontend não envia token nesta rota. Se a quiserem proteger, avisem.

### `PUT /v1/farmacias/:id/stock/:medicamentoId` → nó líder, com token

```json
pedido   { "quantidade": 10, "versao": 4 }
200      { "medicamentoId": 3, "quantidade": 10, "versao": 5 }
409      { "erro": "conflito", "actual": { "quantidade": 9, "versao": 5 } }
```

| Código  | Quando                                                       | O que o frontend faz                                  |
| ------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 200     | Gravado; `versao` sobe 1                                     | Actualiza a linha                                     |
| 400     | `quantidade` não é inteiro ≥ 0                               | Mostra o erro no campo                                |
| 401     | Token em falta, inválido ou expirado                         | Termina a sessão e vai para o login                   |
| 403     | Operador de outra farmácia, ou o nó não é o líder            | Mostra «Não foi possível gravar»                      |
| 409     | `versao` enviada ≠ versão actual                             | Mostra «Outra pessoa alterou… Valor actual: 9.» **(precisa de `actual.quantidade`)** |
| 503     | O nó não pode escrever agora                                 | Farmácia «só de leitura»                              |

O frontend **não reenvia** depois de um 409: a pessoa recarrega e decide.

## 5. Painel (a cada nó, de 2 em 2 s)

### `GET /v1/metricas`

```json
200
{
  "no": "A",
  "modo": "normal",
  "lider": 1,
  "replica": 3,
  "ultimoSinal": "2026-10-12T08:00:02Z",
  "janela": {
    "inicio": "2026-10-12T07:59:57Z",
    "pedidos": 14,
    "medianaMs": 120,
    "p95Ms": 380,
    "conflitos409": 0,
    "atrasoReplicaMs": 45,
    "maisPesquisados": [ { "nome": "Paracetamol", "total": 6 } ]
  }
}
```

- `janela`: os últimos 5 s.
- `maisPesquisados`: as pesquisas **que este nó coordenou**. O frontend soma as listas dos 3 nós,
  por isso não devolvam um total global repetido em cada nó.
- Campos em falta são tratados como 0 ou lista vazia, mas convém enviá-los todos.
- Como o painel decide o estado de cada nó:
  - **indisponível** se não responde há 6 s;
  - **lento** se a resposta demora mais de 1 s **ou** `modo` é `"lento"`;
  - **vivo** no resto dos casos.

  **Importante:** com o nó em modo «lento», esta rota deve responder **dentro de 2 s** (por
  exemplo, com +1,2 s de atraso). Se demorar 6 s, o painel corta o pedido e mostra o nó como
  «indisponível» em vez de «lento». O atraso de 6 s é para a pesquisa e para o stock.

### `GET /v1/eventos?desde=<id>`

```json
200
{ "eventos": [ { "id": 17, "hora": "2026-10-12T08:00:01Z", "no": "A", "tipo": "conflito", "detalhe": "409 na Farmácia 1" } ] }
```

- Este formato não estava definido no enunciado. É o que o frontend usa.
- `id`: número que só cresce, em cada nó. O frontend pede `desde=<maior id que já recebeu>`.
- `tipo` reconhecidos (com etiqueta própria): `conflito`, `escrita`, `replica`, `modo`,
  `reposicao`. Outros aparecem com o texto tal como vem.
- `detalhe`: frase curta em português, que aparece na lista.
- Os eventos «Nó B ficou indisponível», «vivo» e «lento» são criados pelo próprio painel, porque um
  nó parado não os consegue enviar.

## 6. Administração (só `papel: "admin"`, com token)

| Rota                         | Destino      | Corpo                              | Resposta 200                    |
| ---------------------------- | ------------ | ---------------------------------- | ------------------------------- |
| `POST /v1/admin/modo`        | o nó         | `{ "modo": "normal" \| "parado" \| "lento" }` | `{ "no": "A", "modo": "parado" }` |
| `POST /v1/admin/algoritmo`   | balanceador  | `{ "algoritmo": "round-robin" \| "menos-ligacoes" \| "pesos" }` | `{ "algoritmo": "pesos" }` |
| `POST /v1/admin/repor`       | cada nó      | (vazio)                            | `{ "no": "A", "reposto": true }` |

- **401** sem token válido e **403** sem `papel` admin; nos dois casos o frontend volta ao login.
- **Muito importante:** um nó em modo **«parado»** deixa de responder a tudo **excepto** a
  `POST /v1/admin/modo` e `POST /v1/admin/repor`. Se não for assim, depois de parar um nó não há
  forma de o voltar a ligar a partir do painel.
- `repor` volta o stock da farmácia de que o nó é líder aos valores iniciais e põe o nó em `normal`.

## 7. Contas de teste esperadas

| Utilizador  | Palavra-passe | Papel    | Farmácia |
| ----------- | ------------- | -------- | -------- |
| `operador1` | `teste123`    | operador | 1        |
| `operador2` | `teste123`    | operador | 2        |
| `operador3` | `teste123`    | operador | 3        |
| `admin`     | `admin123`    | admin    | —        |

## 8. Como testar o frontend contra o vosso backend

1. Pôr o backend a correr nas portas da secção 1.
2. Servir o frontend (`npx serve frontend` ou Live Server) e abrir qualquer página com
   `?simulador=nao` no fim do endereço. A escolha fica guardada nesse separador.
3. Para voltar ao simulador: `?simulador=sim`.
4. Na consola do navegador (F12), «Network» mostra cada pedido, o código e o corpo.
