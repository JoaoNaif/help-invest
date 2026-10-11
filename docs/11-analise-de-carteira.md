# 11 — Análise da carteira por cenário e estratégia

> Status: `[decidido]` e implementado em 2026-10-10. Contrato HTTP: [`09`](./09-api-referencia.md#9-análise-da-carteira-por-cenário-e-estratégia). Decisão: [`05`](./05-decisoes.md).

## Ideia

O usuário escolhe uma **estratégia** (equilibrar, rentabilizar, gerar renda, proteger). O motor compara a
**carteira atual** com uma **faixa-alvo por classe de ativo** (função do perfil e da estratégia), lê o
**cenário de juros** (Selic, CDI, IPCA) e devolve quais classes estão abaixo, dentro ou acima da faixa.
**Não indica produto nem ticker.**

Foco do produto: **carteira + objetivo do usuário + mercado atual**.

| Entrada | De onde vem | Papel |
|---|---|---|
| Carteira | `Position` (valor investido por `assetType` + `indexer`) | o que existe hoje |
| Objetivo | `InvestorProfile` (tolerância a risco, horizonte, `goal`, reserva) + **estratégia** do pedido | decide a faixa-alvo e o teto de risco |
| Mercado | `IndicatorValue` (Selic, CDI, IPCA do BCB) | desempata a ordem e gera motivo |

```
Posições ─┐
Perfil ───┼─► PortfolioAnalyzer (puro) ─► caminhos ranqueados ─► persiste (snapshot)
Estratégia┤                                                          │
Selic/CDI/IPCA ┘                              POST .../explanation ◄─┘ (LLM, só sob demanda)
```

Código: `src/domain/portfolio-analysis/` (`AssetClassifier`, `TargetAllocation`, `MarketScenario`,
`PortfolioAnalyzer`) e os use-cases `Create/Get/List/ExplainPortfolioAnalysis`.

## Princípios

- Números e decisões em **código**. O LLM só explica o que o motor calculou.
- **Informação, não recomendação.** Texto descreve a situação; nunca "compre/venda".
- `null` = dado indisponível, nunca zero. Valores como string decimal (`Decimal`).
- Todo dado com fonte e data; premissas gravadas em `assumptions`.
- **Perfil nunca bloqueia** (sem perfil: `MEDIUM` + 60 meses + `PROFILE_MISSING`). **Mercado nunca bloqueia**
  (sem dado: campo `null` + `MARKET_DATA_UNAVAILABLE`).

## 1. Classes de ativo

| `assetClass` | Regra | Tem faixa-alvo |
|---|---|---|
| `FIXED_POST` | renda fixa (CDB, LCI, LCA, LC, TESOURO, DEBENTURE, CRI, CRA) com `CDI` ou `SELIC` | sim |
| `FIXED_INFLATION` | renda fixa com `IPCA` | sim |
| `FIXED_PRE` | renda fixa com `PRE` | sim |
| `STOCKS` | `ACAO` | sim |
| `REAL_ESTATE_FUNDS` | `FII` | sim |
| `CRYPTO` | `CRIPTO` | sim |
| `FUNDS` | `FUNDO` | **não** (o motor não sabe o que há dentro) |
| `OTHER` | `OUTRO` e renda fixa sem indexador | **não** |

`FUNDS` e `OTHER` aparecem em `current`, não geram caminho e, acima de 20% da carteira, geram
`UNCLASSIFIED_ALLOCATION`.

## 2. Faixa-alvo (regra do produto, **não é norma**)

Versão 1, definida em 2026-10-10. Faixas em % da carteira, para horizonte ≥ 60 meses. São **bandas**:
não precisam somar 100. Constante em `services/target-allocation.ts` (`BASE_TARGET_ALLOCATION`);
**mude a versão em `TARGET_ALLOCATION_SOURCE` ao alterar a tabela.**

| Classe | LOW | MEDIUM | HIGH |
|---|---|---|---|
| `FIXED_POST` | 40–60 | 20–40 | 10–25 |
| `FIXED_INFLATION` | 20–35 | 15–30 | 10–20 |
| `FIXED_PRE` | 0–15 | 0–15 | 0–10 |
| `STOCKS` | 0–5 | 10–25 | 25–40 |
| `REAL_ESTATE_FUNDS` | 0–10 | 10–20 | 10–25 |
| `CRYPTO` | 0 | 0–5 | 0–10 |

Aplicação, nesta ordem:

1. **Tabela** pela `riskTolerance` do perfil (sem perfil: `MEDIUM`).
2. **Estratégia**, só **dentro do teto de risco** (nunca passa do máximo da tabela):
   - `BALANCE`: faixas da tabela.
   - `MAX_RETURN`: piso da renda variável sobe até o meio da faixa (metade superior).
   - `PROTECT`: teto da renda variável desce até o meio da faixa (metade inferior).
   - `INCOME`: piso de `REAL_ESTATE_FUNDS` e `FIXED_INFLATION` sobe até o meio da faixa.
3. **Horizonte** (`horizonMonths`, sem perfil: 60): renda variável (`STOCKS` + `REAL_ESTATE_FUNDS` +
   `CRYPTO`) soma no máximo **10%** com < 36 meses e **25%** com 36–59 meses. Se a soma dos máximos passa
   do teto, as faixas (mín e máx) da renda variável são **escaladas proporcionalmente**.
   Objetivo `RESERVE` é tratado como horizonte curto (35 meses).
4. **Redistribuição:** o que a estratégia ou o horizonte tiraram da renda variável (soma dos mínimos e
   dos máximos) é somado, **meio a meio**, às faixas de `FIXED_POST` e `FIXED_INFLATION` (máximo 100%).
   *Decisão além do enunciado original:* a regra original só redistribuía o excedente do horizonte; aqui
   `PROTECT` também redistribui, para a faixa-alvo de quem quer proteger não "sumir" com o que saiu da
   renda variável.
5. **Alerta `STRATEGY_LIMITED_BY_PROFILE`** quando `MAX_RETURN` esbarra no perfil (tolerância ≠ HIGH ou
   teto de horizonte aplicado): sem ele o usuário acharia que a estratégia foi ignorada.

## 3. Caminhos (`paths`)

Para cada uma das 6 classes com faixa: `atual` (% da carteira) contra `min`–`max`.

- abaixo do mínimo → `INCREASE`, `gap = min − atual`
- acima do máximo → `REDUCE`, `gap = atual − max`
- dentro → `MAINTAIN`, `gap = 0`

**Ordem:** maior `gap` primeiro; empate pelo cenário (quem ele reforça sobe se precisa aumentar, quem ele
enfraquece sobe se precisa reduzir); depois a ordem de exibição das classes. `MAINTAIN` fica por último.

Cada caminho traz `reasons` (código + texto pt-BR do motor: situação frente à faixa, ajuste de estratégia,
teto de horizonte, cenário) e `risks` (risco típico da classe nos `INCREASE`; `LOW_RESERVE_FOR_STOCKS` nas
classes de renda variável que não são `REDUCE` quando a reserva está baixa).

Carteira vazia: atual = 0 em tudo, os caminhos são a faixa-alvo completa e vem `PORTFOLIO_EMPTY`.

## 4. Reserva de emergência

`recommended = 6 × monthlyIncome` (`PortfolioRules.recommendedReserve`); `current` é a reserva **declarada
no perfil**, não as posições. Vai no bloco `reserve` do resultado (não é uma classe de ativo, por isso não
é um `path`). Reserva baixa também gera `LOW_EMERGENCY_RESERVE` (reaproveitado do resumo da carteira) e o
risco `LOW_RESERVE_FOR_STOCKS` nos caminhos de renda variável. Sem perfil: `reserve = null`.

## 5. Cenário de mercado

| Item | Cálculo |
|---|---|
| `ipca12m` | IPCA mensal composto dos **12 últimos meses seguidos**; `null` se faltar mês ou o último tiver mais de 100 dias |
| `realRate` | `((1 + Selic meta) / (1 + ipca12m) − 1) × 100` — juro real aproximado, ex-post |
| `selicTrend` | Selic de hoje − Selic de ~6 meses atrás: `≥ +0,5 p.p.` RISING · `≤ −0,5 p.p.` FALLING · senão STABLE; `null` sem histórico (valor histórico a mais de 45 dias da data-alvo não vale) |
| frescor | Selic/CDI com mais de 7 dias = indisponível |

Limiares (regra do produto, constantes nomeadas em `market-scenario.ts`): juro real **alto ≥ 6%**,
**baixo < 3%**. Precedência (o enunciado deixava em aberto):

1. juro real < 3% → favorece `STOCKS` e `REAL_ESTATE_FUNDS`
2. juro real ≥ 6% **e** Selic caindo → fixa a taxa real: reforça só `FIXED_INFLATION`
3. juro real ≥ 6% → reforça `FIXED_POST` e `FIXED_INFLATION`; renda variável fica na ponta baixa
4. Selic caindo (juro real entre 3% e 6%, ou sem juro real) → favorece `STOCKS` e `REAL_ESTATE_FUNDS`
5. senão → neutro

O cenário **só desempata e gera motivo**; não muda a faixa. A mesma leitura, sem a carteira, é
consultável em `GET /market-overview` ([`09`](./09-api-referencia.md#10-mercado-hoje-leitura-do-cenário-de-juros)). Sem preço de ações/FIIs (IFIX, yield médio)
nesta fase — `NO_EQUITY_MARKET_DATA` avisa sempre.

## 6. Explicação (LLM)

- Só sob demanda. Entrada: percentuais, faixas, caminhos, mercado e **códigos** de alerta. Nunca valores em
  reais, renda, reserva em reais, emissor ou CNPJ (minimização, LGPD).
- Saída `{ summary, highlights: [{ assetClass, text }], attentionPoints }`, por JSON Schema + Zod.
  O domínio descarta `assetClass` inventada, repetida ou com texto vazio e apara as listas em 3 itens.
- Registrada em `LlmLog` com `LlmPurpose.PORTFOLIO_EXPLANATION` e `portfolioAnalysisId`; o `response` tem
  o formato `{ explanation, raw }` (igual ao do comparador). O `GET :id` devolve a última explicação válida.

## 7. Fora do escopo desta fase

Catálogo de produtos disponíveis hoje; preço de FII/ações (IFIX, yield médio); texto livre como
estratégia; explicação por classe com dados externos; ação para `CRYPTO`/`REAL_ESTATE_FUNDS` no front
(ainda sem ferramenta).
