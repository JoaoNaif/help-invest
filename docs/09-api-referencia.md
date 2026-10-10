# 09 — Referência da API (para o front)

> **Público:** o Claude (ou quem for) que vai construir o front lendo este repositório.
> Este é o contrato HTTP do backend. Regras de produto e decisões: [`05-decisoes.md`](./05-decisoes.md);
> alertas regulatórios que o texto da UI precisa respeitar: [`03-alertas-regulatorios-e-riscos.md`](./03-alertas-regulatorios-e-riscos.md).
> Se algo aqui divergir do código, o código vence (`src/infra/http/controllers/` e `schemas/`) — e este doc deve ser corrigido.

Base local: `http://localhost:3333` · JSON em tudo · `GET /health` (público) responde que a API está de pé.

## 1. Regras que valem para o front inteiro

1. **Nada de conta no front.** Taxa líquida, imposto, concentração, alertas: tudo vem pronto do backend. O front só exibe e formata. (Princípio do produto: números são código; o LLM só extrai e explica.)
2. **Dinheiro e taxas chegam como `string`** (`"12.888448"`, `"10000"`), nunca como número. Mande como string ou número, receba sempre string. Não use `float` para somar/comparar; para exibir, formate (`Intl.NumberFormat('pt-BR')`) ou use `decimal.js`. Zeros à direita são cortados (`"8000.5"`, não `"8000.50"`).
3. **Datas de calendário** (vencimento, data do aporte) trafegam como `"YYYY-MM-DD"`. Timestamps (`createdAt`, `updatedAt`) são ISO 8601 UTC.
4. **Taxa `rate` depende do indexador:** `110` = 110% do CDI · IPCA `6.5` = IPCA + 6,5% a.a. · PRE `14.2` = 14,2% a.a. · SELIC `0.1` = Selic + 0,1%. A UI deve mostrar o sufixo certo conforme `indexer`.
5. **A explicação do LLM indica a opção que mais combina com o objetivo, com prós e contras, mas é informativa — não é recomendação formal.** O texto devolvido **não traz aviso legal**: a tela deve mostrar sempre que é informação e que a decisão é do investidor.

## 2. Sessão, cookies e CORS (desenvolvimento em localhost)

- Login entrega dois cookies **httpOnly** (JS do front não lê, e nem precisa): `access_token` (JWT, 15 min, `Path=/`) e `refresh_token` (longa duração, `Path=/sessions`, só viaja para as rotas de sessão). `SameSite=Strict`; `Secure` só fora de dev.
- **Toda chamada precisa de `credentials: 'include'`** (fetch) / `withCredentials: true` (axios).
- **CORS:** por padrão aceita as origens `http://localhost:3000` (Next) e `http://localhost:5173` (Vite). Outra porta/origem: defina `CORS_ORIGINS` no `.env` do backend (lista separada por vírgula) e reinicie.
- **CSRF:** `POST/PUT/PATCH/DELETE` com header `Origin` fora de `CORS_ORIGINS` recebem **403**. O navegador já manda `Origin` sozinho; basta o front rodar em uma origem liberada.
- **Mesmo *site*:** em `localhost`, a porta não conta — `localhost:3000` → `localhost:3333` é *same-site*, então `SameSite=Strict` funciona. Em produção o front e a API precisam ficar sob o mesmo domínio base (ex.: `app.dominio.com` e `api.dominio.com`); domínios diferentes quebram o cookie. Use `localhost` (não `127.0.0.1`) nos dois lados, e não misture.
- **Saber se está logado:** `GET /me` → `200` com o usuário ou `401`. É a única fonte (os cookies são ilegíveis ao JS).
- **Renovação:** quando qualquer rota autenticada devolver `401`, chame `POST /sessions/refresh` (204) **uma vez** e repita a requisição original; se o refresh também der `401`, a sessão acabou → tela de login. Dispare um único refresh por vez (várias requisições `401` simultâneas devem esperar o mesmo).

```ts
// Esqueleto de cliente (fetch). Ajuste ao framework.
const API = 'http://localhost:3333'
let refreshing: Promise<boolean> | null = null

async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(API + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (res.status === 401 && retry && !path.startsWith('/sessions')) {
    refreshing ??= fetch(API + '/sessions/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .finally(() => (refreshing = null))

    if (await refreshing) return api(path, init, false)
  }

  return res
}
```

## 3. Erros

Formato Nest padrão: `{ "message": "...", "error": "Not Found", "statusCode": 404 }`.
Validação (**400**): `{ "message": "Validation failed", "statusCode": 400, "errors": { "details": [ { "path": ["name"], "message": "...", "code": "..." } ] } }` — use `errors.details[].path` para marcar o campo.

| Status | Quando |
|---|---|
| 400 | corpo/parâmetro/query inválido (id que não é UUID também) |
| 401 | sem sessão ou token expirado → refresh; credencial errada no login |
| 403 | recurso de outro usuário; ou `Origin` não liberada |
| 404 | recurso não existe (ou perfil ainda não preenchido) |
| 409 | ação inválida para o status atual da comparação, e-mail já cadastrado |
| 422 | entrada que o sistema não consegue processar (nenhuma opção encontrada, tipo de ativo fora do comparador) |
| 429 | limite de requisições (ver §10) |
| 503 | LLM ou dados de mercado indisponíveis — **tentar de novo mais tarde** |

## 4. Contas e sessão

| Método e rota | Corpo | Resposta |
|---|---|---|
| `POST /accounts` | `{ name, email, password }` (senha 8–72) | `201 { user }` · `409` e-mail já existe |
| `POST /sessions` | `{ email, password }` | `204` + cookies · `401` credencial errada |
| `POST /sessions/refresh` | — | `204` + cookies novos · `401` |
| `DELETE /sessions` | — | `204`, limpa cookies (funciona mesmo com access token expirado) |
| `GET /me` | — | `200 { user }` · `401` |

`user`: `{ id, name, email, createdAt }`.

## 5. Perfil do investidor

O perfil personaliza alertas e explicações. Um por usuário.

- `PUT /investor-profile` (cria ou atualiza) — corpo:
  `{ monthlyIncome, emergencyReserve, goal, horizonMonths, riskTolerance }`
  (`monthlyIncome`/`emergencyReserve` ≥ 0; `horizonMonths` inteiro > 0) → `200 { profile }`.
- `GET /investor-profile` → `200 { profile, isOutdated }` · `404` se ainda não preencheu. `isOutdated: true` = perfil com mais de 6 meses → peça revisão.

`profile`: `{ id, monthlyIncome, emergencyReserve, goal, horizonMonths, riskTolerance, createdAt, updatedAt }`.

## 6. Carteira

`position` (resposta): `{ id, assetType, name, issuerName, issuerCnpj, investedAmount, indexer, rate, investedAt, maturityAt, liquidity, source, createdAt, updatedAt }` — campos opcionais vêm `null`. `source` = `MANUAL` (por ora sempre).

- `POST /positions` → `201 { position }`. Corpo: `assetType`, `name`, `investedAmount` (> 0) obrigatórios; opcionais: `issuerName`, `issuerCnpj` (**14 dígitos, sem máscara**), `indexer`, `rate` (≥ 0), `investedAt`, `maturityAt` (`YYYY-MM-DD`), `liquidity`.
- `GET /positions` → `200 { positions }` (mais recentes primeiro, sem paginação).
- `PATCH /positions/:id` → `200 { position }`. Mesmos campos, **todos opcionais**: campo **ausente** = não altera; `null` = limpa; valor = altera. (Nunca mande `undefined`/campo vazio por engano: `null` apaga.)
- `DELETE /positions/:id` → `204` · `403` de outro usuário · `404`.
- `GET /portfolio/summary` → `200 { summary }`:

```json
{
  "summary": {
    "total": "10000",
    "byAssetType": [{ "key": "CDB", "amount": "10000", "percentage": "100" }],
    "byIndexer":   [{ "key": "CDI", "amount": "10000", "percentage": "100" }],
    "byIssuer": [{ "issuerCnpj": "12345678000199", "issuerName": "Banco X", "amount": "10000",
                   "percentage": "100", "fgcCoveredAmount": "10000", "fgcUncoveredAmount": "0" }],
    "alerts": [{ "code": "PROFILE_MISSING", "severity": "INFO", "message": "..." }]
  }
}
```

`percentage` é em pontos percentuais (0–100) sem arredondamento; `byIndexer[].key` pode ser `null` (posições sem indexador, ex. ações). Carteira vazia devolve total `"0"` e listas vazias.

## 7. Comparador (o diferencial do produto)

### Máquina de estados

```
POST /comparisons ──► DRAFT ──(PUT /options, quantas vezes quiser)──► DRAFT
                        │
                        └─ POST /:id/evaluate ──► DONE ──► explanation / chosen-option / GET
```

- **DRAFT:** o usuário confere/corrige as opções (importante quando vieram do LLM, que pode errar). Só aqui se edita (`PUT /options`).
- **DONE:** o motor calculou. Aqui valem `explanation`, `chosen-option` e a leitura do resultado. Opções de uma comparação `DONE` **não** mudam: para outra versão, crie nova comparação.
- Ação no status errado → **409**.
- (`CONFIRMED` existe no enum, mas o `evaluate` passa direto de `DRAFT` a `DONE`; o front não precisa tratá-lo.)

### Formatos

`comparison`: `{ id, amount, horizonMonths, status, assumptions, chosenOptionId, goal, createdAt, updatedAt }` — `goal` é o objetivo deste dinheiro (`RESERVE` | `RETIREMENT` | `PURCHASE` | `GROWTH`) ou `null`.
`option`: `{ id, assetType, issuerName, issuerCnpj, indexer, rate, maturityAt, liquidity, graceDays, minAmount, netAnnualRate, alerts, rawInput, source, createdAt }`

- `netAnnualRate`: taxa líquida a.a. após IR, **só existe depois do `evaluate`** (antes é `null`). É o número para ordenar/comparar.
- `alerts`: `[{ code, severity: "INFO" | "WARNING" | "DANGER", message }]`. **Mostre o `message`** (já em português); use `severity` para cor/ícone e `code` como identificador estável (ex.: `ABOVE_FGC_LIMIT`, `GRACE_PERIOD`, `ISSUER_CONCENTRATION`, `RATE_ABOVE_MARKET`, `BELOW_MIN_AMOUNT`, `SHORT_TERM_IOF`, `MATURITY_IN_PAST`, `MATURITY_AFTER_HORIZON`, `NO_FGC_COVERAGE`, `ISSUER_CNPJ_MISSING`, `LOW_LIQUIDITY_NO_RESERVE`, `LOW_EMERGENCY_RESERVE`, `PROFILE_MISSING`, `PROFILE_OUTDATED`). A lista de códigos pode crescer: trate código desconhecido exibindo o `message` normalmente.
- `source`: `MANUAL` (digitada) ou `LLM_EXTRACTED` (veio de texto/print) — destaque as `LLM_EXTRACTED` na conferência.
- `assumptions` (só em `DONE`): objeto livre com as premissas do cálculo (data, CDI/Selic/IPCA usados com fonte e data, prazos, alíquotas, notas). Serve para uma área "como calculamos". **Não é contrato estável** — não dependa de campos específicos além de exibi-lo.

### Rotas

- **`POST /comparisons`** → `201 { comparison, options }` (status `DRAFT`). Limite: 10/min.
  Corpo: `{ amount (> 0), horizonMonths (int > 0), goal?, input }`. `goal` é opcional (`null`/ausente = sem objetivo); quando informado, **vale mais que o objetivo do perfil** na explicação. `input` é um de:
  - `{ "type": "manual", "options": [ option, ... ] }` — 1 a 20 opções. Cada opção de entrada: `assetType`, `indexer`, `rate` (> 0) obrigatórios; opcionais: `issuerName`, `issuerCnpj` (14 dígitos), `maturityAt`, `liquidity`, `graceDays` (int ≥ 0; carência em dias), `minAmount`, `rawInput`.
  - `{ "type": "text", "text": "..." }` — texto colado (até 20 000 caracteres); o LLM extrai as opções.
  - `{ "type": "image", "base64": "...", "mediaType": "image/png" | "image/jpeg" | "image/webp" }` — print (até ~5 MB; base64 **sem** o prefixo `data:...;base64,`). A imagem **não é armazenada**.
  - Erros: `422` nada encontrado/leitura falhou (sugira digitar manualmente), `503` LLM fora do ar.
- **`PUT /comparisons/:id/options`** (só `DRAFT`) → `200 { comparison, options }`. Corpo `{ options: [...] }` = a **lista completa já corrigida** (1–20): item **com `id`** edita a opção existente, **sem `id`** cria nova (sempre `MANUAL`), opção **ausente** da lista é removida. `409` se não for `DRAFT`.
- **`POST /comparisons/:id/evaluate`** → `200 { comparison, options }` (agora `DONE`, com `netAnnualRate` e `alerts`). Sem corpo. Erros: `422` tipo de ativo fora do comparador (só renda fixa: CDB, LCI, LCA, LC, TESOURO, DEBENTURE, CRI, CRA), `503` sem índice recente (CDI/Selic > 7 dias ou IPCA > 100 dias — ver `05-decisoes.md`, "Dados de mercado"), `409` já avaliada.
- **`POST /comparisons/:id/explanation`** (só `DONE`) → `200 { explanation }` com a explicação **estruturada** (ver abaixo). Cada chamada **gasta crédito da API**: gere sob demanda (botão), não automaticamente; se já existir, `GET /comparisons/:id` devolve a última. Limite 10/min. `503` LLM fora, `502` resposta inválida do LLM (pode tentar de novo).
- **`PUT /comparisons/:id/chosen-option`** (só `DONE`) → `200 { comparison }`. Corpo `{ optionId }`. Registra o que o usuário escolheu; pode trocar depois. `404` se a opção não é da comparação.
- **`GET /comparisons/:id`** → `200 { comparison, options, explanation }`. Em `DONE` as `options` vêm **ordenadas da maior para a menor `netAnnualRate`**; em `DRAFT`, na ordem de criação. `explanation` = última explicação gerada (mesmo formato do `POST`) ou `null`.
- **`GET /comparisons?page=1`** → `200 { comparisons }` (20 por página, mais recentes primeiro, **sem** `options`; abra o detalhe para ver). `page` ≥ 1. Cada item é o `comparison` mais um resumo: `optionsCount` (quantas opções) e `topOption: { issuerName, assetType, netAnnualRate } | null` — a de maior taxa líquida; **`null` enquanto a comparação não foi avaliada**.
- **`GET /comparison-options/recent`** → `200 { options }`: até 8 opções **distintas** que o usuário já usou em outras comparações, das mais recentes para as mais antigas (a mesma opção — tipo, emissor sem diferenciar maiúsculas, indexador, taxa, vencimento e liquidez — aparece uma vez). Só dados de entrada, prontos para preencher um formulário: `{ assetType, issuerName, issuerCnpj, indexer, rate, maturityAt, liquidity, graceDays, minAmount }` (sem `id`, resultado do motor nem `source`). Lista vazia se não há histórico. Vem do backend e sincroniza entre dispositivos; substitui o `localStorage`.

### Formato da explicação

```json
{
  "summary": "2 a 3 frases, linguagem simples",
  "bestOptionId": "uuid de uma opção desta comparação, ou null",
  "bestReason": "por que combina com o objetivo (null se bestOptionId é null)",
  "options": [{ "optionId": "uuid", "pros": ["..."], "cons": ["..."] }]
}
```

- **Como o LLM escolhe a indicação:** pelo `goal` da comparação; sem ele, pelo objetivo/risco/horizonte do perfil; sem perfil, pela maior taxa líquida. Alertas `DANGER` pesam contra.
- `options` tem **uma entrada por opção** (2 a 3 itens curtos em `pros` e `cons`; no máximo 3). Pode vir incompleta: se faltar a entrada de uma opção, mostre-a sem prós/contras.
- **`optionId`/`bestOptionId` sempre existem na comparação**: o backend descarta ids que o LLM inventou. Se a indicação foi descartada, `bestOptionId` e `bestReason` vêm `null` — não mostre destaque.
- **Compatibilidade:** só existe este formato. Explicações antigas em texto corrido (anteriores a esta mudança) não são devolvidas: o `GET` traz `explanation: null` e basta gerar de novo.

### Fluxo sugerido de telas

1. Valor + prazo + (digitar opções | colar texto | enviar print) → `POST /comparisons`.
2. **Conferência** das opções (editável; destaque `LLM_EXTRACTED`) → `PUT /options` ao salvar correções.
3. "Comparar" → `POST /evaluate` → ranking por `netAnnualRate` com `alerts` por opção.
4. Botão "Explicar" → `POST /explanation`.
5. "Escolhi esta" → `PUT /chosen-option`.
6. Histórico → `GET /comparisons` (já traz `optionsCount` e `topOption`).
7. Opções recentes para preencher o formulário → `GET /comparison-options/recent`.

## 8. Análise de ações

O usuário informa **uma ação** ou **uma ação com outra** (até 2) e, opcionalmente, quanto pretende investir em cada. O backend busca os dados, calcula tudo em código e cruza com a carteira e o perfil. **Não há LLM nesta rota** (a explicação em texto vem depois).

> **Regras de exibição**
> - É **informação, não recomendação**. Mostre o aviso fixo (regra 5 da seção 1) e nunca rotule uma ação como "compre" ou "venda".
> - Nesta seção os valores saem como `string` **com 2 casas fixas** (`"8.00"`, `"33.33"`), diferente da regra 2 da seção 1.
> - `null` significa **dado indisponível**, nunca zero. Mostre "—" ou "sem dado".
> - Cada item traz `source` (fonte) e `priceDate` (data da cotação): exiba junto do preço.

### Rotas

| Rota | Corpo / query | Resposta |
|---|---|---|
| `POST /stock-analyses` | `{ items: [{ ticker, amount? }] }` — 1 ou 2 itens; `amount` opcional (> 0) | `201 { analysis }` |
| `GET /stock-analyses/:id` | — | `200 { analysis }` |
| `GET /stock-analyses?page=1` | `page` ≥ 1 (20 por página, mais recentes primeiro) | `200 { analyses: [analysis] }` |

Erros do `POST`: `400` corpo fora do formato (0 ou 3+ itens, `amount` ≤ 0) · `404` ticker não encontrado · `422` tickers repetidos · `503` fonte de dados fora do ar (tente de novo) · `429` limite (20/min). Do `GET :id`: `404` não existe · `403` é de outro usuário · `400` id inválido.

`ticker` aceita minúsculas e espaços (`" bbas3 "` vira `BBAS3`). Uma análise leva ~3 s (consulta a ação e os concorrentes): mostre estado de carregamento.

### Formato

```jsonc
{
  "analysis": {
    "id": "uuid",
    "tickers": ["BBAS3", "ITUB4"],
    "createdAt": "2026-10-09T21:00:00.000Z",
    "result": {
      "items": [ /* um por ticker, na ordem pedida */ {
        "ticker": "BBAS3",
        "name": "Banco do Brasil S.A.",
        "sector": "Financial Services",       // string | null
        "price": "24.64",                     // R$
        "priceDate": "2026-10-09T21:31:30.000Z",
        "plannedAmount": "5000.00",           // string | null (o que o usuário informou)
        "source": "Yahoo Finance",
        "fundamentals": {                     // todos string | null
          "priceToEarnings": "11.46", "priceToBook": "0.77",
          "earningsPerShare": "2.15", "bookValuePerShare": "31.88",
          "returnOnEquity": "10.55"           // %
        },
        "dividends": {
          "trailing12mPerShare": "0.65",      // R$ por ação, 12 meses, BRUTO
          "trailing12mYield": "2.66",         // % (calculado por nós)
          "averageAnnualPerShare": "1.63",    // string | null — média dos anos cobertos
          "yearsCovered": 5, "yearsWithPayment": 5, "consistent": true,
          "upcoming": { "exDate": "2026-12-01", "amountPerShare": "0.1053" } | null,
          "dateKind": "EX"                    // sempre data EX, não data com
        },
        "ceilingPrices": [                    // pode vir vazio; um por método com dado
          { "method": "BAZIN",  "value": "27.24", "upsidePercent": "10.55" },
          { "method": "GRAHAM", "value": "39.27", "upsidePercent": "59.37" }
        ],
        "valuation": {
          "group": "bancos",                  // string | null (sem grupo = sem comparação)
          "priceToEarnings": { "value": "11.46", "peerMedian": "13.26", "diffPercent": "-13.57", "verdict": "FAIR" },
          "priceToBook":     { "value": "0.77",  "peerMedian": "1.26",  "diffPercent": "-38.89", "verdict": "CHEAP" },
          "peers": [ { "ticker": "ITUB4", "name": "…", "priceToEarnings": "12.19", "priceToBook": "2.55", "dividendYield": "6.14" } ],
          "peersUnavailable": []              // concorrentes que a fonte não respondeu
        },
        "consensus": { "analystCount": 13, "buy": 2, "hold": 8, "sell": 3, "targetPrice": "24.82" } | null,
        "alerts": [ { "code": "DIVIDENDS_BELOW_AVERAGE", "severity": "INFO", "message": "…" } ]
      } ],
      "alerts": [ /* da análise toda: perfil e combinação (ex.: SAME_SECTOR) */ ]
    },
    "assumptions": { /* premissas e fontes usadas; útil para uma tela "como calculamos" */ }
  }
}
```

### Como exibir

- **Preço teto** (`ceilingPrices`): é **referência de método, não previsão**. Mostre sempre o nome do método e a premissa: *Bazin* = média de dividendos dos últimos anos ÷ 6%; *Graham* = √(22,5 × LPA × VPA). `upsidePercent` positivo = preço abaixo do teto. Lista vazia = sem dado suficiente (ex.: prejuízo).
- **Valuation** (`verdict`): `CHEAP` / `FAIR` / `EXPENSIVE` comparado com a **mediana dos concorrentes** (±15% = na média); `UNAVAILABLE` = não comparável (prejuízo ou sem concorrentes). Mostre a tabela `peers` ao lado.
- **Consenso** é a **tendência** do que os analistas dizem, não a opinião de um especialista: exiba sempre `analystCount` ("13 analistas"). `null` = sem cobertura.
- **Dividendos:** valores **brutos** (IR do JCP não descontado) e na **data ex**; a data com é o dia útil anterior. `consistent: false` = não pagou em todos os anos cobertos. `yearsCovered` pode ser menor que 5 (histórico curto): mostre "baseado em N anos".
- **Dois itens:** compare lado a lado. Se forem do mesmo setor, `result.alerts` traz `SAME_SECTOR`.
- **Alertas:** mesmo formato dos demais (`code`, `severity`, `message`); o texto já vem em português.

### Códigos de alerta desta seção

| `code` | Onde | Quando |
|---|---|---|
| `STALE_PRICE` | item | cotação com mais de 5 dias |
| `NO_PEERS` | item | ticker fora das listas de concorrentes |
| `NEGATIVE_EARNINGS` | item | lucro por ação ≤ 0 |
| `DIVIDEND_HISTORY_MISSING` · `NO_DIVIDENDS` · `DIVIDENDS_INCONSISTENT` · `DIVIDENDS_BELOW_AVERAGE` | item | histórico de proventos |
| `ABOVE_CEILING` | item | preço acima de todos os tetos |
| `NO_ANALYST_COVERAGE` · `LOW_ANALYST_COVERAGE` | item | consenso ausente ou com < 5 analistas |
| `ALREADY_HOLDS` · `COMPANY_CONCENTRATION` · `SECTOR_CONCENTRATION` | item | já tem a ação / passa de 20% na empresa / de 35% no setor (depois do aporte) |
| `SAME_SECTOR` | análise | duas ações do mesmo setor |
| `PROFILE_MISSING` · `LOW_RESERVE_FOR_STOCKS` · `GOAL_IS_RESERVE` · `STOCKS_ABOVE_RISK_TOLERANCE` · `SHORT_HORIZON_FOR_STOCKS` | análise | perfil do investidor |

### Limitações conhecidas

- **Concorrentes** só existem para **bancos** (`BBAS3`, `ITUB4`, `BBDC4`, `SANB11`); outros setores saem com `valuation.group = null`.
- A carteira reconhece uma ação pelo **ticker no nome** da posição (`assetType: "ACAO"`, `name: "ITUB4"` ou `"ITUB4 - Itaú"`).
- A fonte (Yahoo Finance) é **não oficial**: pode ficar indisponível (`503`) ou trazer campos `null`.

## 9. Enums (valores exatos)

| Campo | Valores |
|---|---|
| `assetType` | `CDB` `LCI` `LCA` `LC` `TESOURO` `DEBENTURE` `CRI` `CRA` `ACAO` `FII` `FUNDO` `CRIPTO` `OUTRO` |
| `indexer` | `PRE` `CDI` `IPCA` `SELIC` |
| `liquidity` | `DAILY` (resgate diário) · `AT_MATURITY` (só no vencimento) · `GRACE_PERIOD` (diária após carência — informar `graceDays`) |
| `goal` | `RESERVE` `RETIREMENT` `PURCHASE` `GROWTH` |
| `riskTolerance` | `LOW` `MEDIUM` `HIGH` |
| `status` (comparação) | `DRAFT` `CONFIRMED` `DONE` |
| `source` | `MANUAL` `LLM_EXTRACTED` |
| `severity` | `INFO` `WARNING` `DANGER` |
| `verdict` (valuation) | `CHEAP` `FAIR` `EXPENSIVE` `UNAVAILABLE` |
| `method` (preço teto) | `BAZIN` `GRAHAM` |

Rótulos em português são responsabilidade do front (mapeie os valores acima).

## 10. Limites de requisição (por IP, por minuto)

Geral 300 · `POST /accounts` 5 · `POST /sessions` 5 · `POST /sessions/refresh` 30 · `POST /comparisons` 10 · `POST /comparisons/:id/explanation` 10 · `POST /stock-analyses` 20. Estouro → `429`; mostre mensagem amigável e peça para aguardar.

## 11. Para subir o backend localmente

`npm run services:up` (Postgres) → `npm run start:dev` (API em `:3333`). Ao subir, o backend sincroniza Selic/CDI/IPCA do Banco Central sozinho (leva alguns segundos na primeira vez; antes disso `evaluate` pode dar 503). Sem `ANTHROPIC_API_KEY` no `.env`, leitura de texto/print e explicação respondem 503 — a comparação com opções digitadas funciona normalmente.
