# Análise de ações

Usuário informa uma ação (ou uma ação **e** outra para comparar a compra); o sistema devolve
dividendos, preço teto, valuation contra concorrentes, tendência dos analistas e o encaixe no
perfil/carteira — de forma simples. Segue os princípios do projeto: **números em código, LLM só
explica, todo dado com fonte e data**.

Status: **back pronto, sem LLM.** Feito: port, fake, serviços de regra, persistência (migration aplicada),
adapter Yahoo, use-cases (criar, buscar, listar), controllers e e2e. Falta: explicação do LLM
(`ExplainStockAnalysis`), concorrentes de outros setores e o front. Contrato HTTP em
[09](./09-api-referencia.md#8-análise-de-ações).

## Contexto e dados

Contexto próprio `stock-analysis` (o comparador atual é de renda fixa e recusa ações com
`UnsupportedAssetTypeError`).

| Dado | Fonte | Observação |
|------|-------|------------|
| Cotação, P/L, P/VP, LPA, VPA, ROE, setor, consenso, proventos (10 anos) | **Yahoo Finance** (`quoteSummary` + `chart?events=div`), sem chave, não oficial | adapter `YahooStockDataProvider` (feito); crumb em cache; chart com `interval=1d` (com `1mo` perde proventos); data **ex**, não data com; não usar o `dividendYield` dele |
| Concorrentes | lista fixa por setor, mantida por nós | determinística; fica em constante com fonte e data |

`StockDataProvider.getSnapshot(ticker)` devolve tudo de uma vez (`StockSnapshot`). Campo que a
fonte não traz é `null`, **nunca zero**. Falha de rede → `MarketDataUnavailableError`; ticker
inexistente → `TickerNotFoundError`.

## Serviços de regra (prontos)

Em `src/domain/stock-analysis/services/`, puros e testados.

| Serviço | O que faz | Premissas (regra do produto ou método, não norma) |
|---------|-----------|----------------------------------------------------|
| `DividendAnalyzer` | proventos 12 m, yield, média anual, consistência, próxima data ex | 5 janelas de 12 meses; janela anterior ao histórico da fonte não conta; valores **brutos** (IR do JCP não descontado) |
| `CeilingPriceCalculator` | preço teto por Bazin e por Graham, com folga/excesso vs. preço | Bazin: média anual ÷ 6%; Graham: √(22,5 × LPA × VPA). Método sem dado (ou LPA/VPA ≤ 0) **não aparece** |
| `ValuationRules` | P/L e P/VP vs. mediana dos concorrentes | "na média" = até ±15% da mediana; múltiplo ≤ 0 (prejuízo) é `UNAVAILABLE` |

Preço teto é **referência de método**, não previsão: a tela deve sempre mostrar o método e a
premissa junto do número.

## Consenso de analistas

É a **tendência** do que os analistas dizem (nº de compra/neutro/venda e preço-alvo médio),
não a opinião de um especialista. Sempre exibido com o **nº de analistas**; `consensus = null`
significa "sem cobertura" e não é erro. A cobertura de B3 nas APIs gratuitas é irregular.

## Persistência — APROVADA em 2026-10-09

Uma tabela nova, no mesmo molde de
`Comparison`:

```prisma
/// Uma análise de ação(ões). Números vêm só do motor de regras; o LLM só explica.
model StockAnalysis {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  /// 1 ticker = análise isolada; 2+ = "comprar com outra".
  tickers     String[]
  /// Resultado completo do motor, por ticker (dividendos, teto, valuation,
  /// concorrentes, consenso, alertas), cada bloco com `source` e `asOf`.
  result      Json
  /// Premissas usadas (6% do Bazin, faixa de ±15%, janelas), para auditoria.
  assumptions Json
  createdAt   DateTime @default(now())

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  llmLogs LlmLog[]

  @@index([userId])
  @@map("stock_analyses")
}
```

Mudanças acopladas: `LlmLog` ganha `stockAnalysisId String? @db.Uuid` (+ relação) e o enum
`LlmPurpose` ganha `STOCK_EXPLANATION`. A explicação do LLM fica no `LlmLog.response`, como
no comparador (`{ explanation, raw }`), sem coluna nova.

Alternativa: normalizar (uma linha por ticker). Descartada por ora: ninguém consulta por
ticker dentro da análise, e o `Json` evita migration a cada campo novo.

## Ordem de construção

1. ✅ Port `StockDataProvider` + fake
2. ✅ Serviços de regra (dividendos, preço teto, valuation)
3. ✅ Schema + migration `add_stock_analyses` + entidade + repositório (Prisma e in-memory)
4. ✅ Concorrentes por setor (só bancos) + `StockRules` + `StockPersonalFit` (concentração e perfil; isenção de R$ 20 mil fica de fora, falta norma com fonte)
5. ✅ Use-cases `CreateStockAnalysis`, `GetStockAnalysis`, `ListStockAnalyses`
6. ✅ Adapter `YahooStockDataProvider` + controllers + e2e (registrado no `HttpModule`)
7. `ExplainStockAnalysis` (LLM) — rota já documentada em [09](./09-api-referencia.md)

## Risco regulatório

"Vale a pena comprar" aproxima o produto de recomendação ([03](./03-alertas-regulatorios-e-riscos.md)).
O texto deve ser "o que os dados mostram + pontos de atenção", não "compre". Revisar antes de
virar serviço.
