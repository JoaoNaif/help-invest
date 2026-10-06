# Stack e arquitetura

Status: [decidido] para o início; revisar ao longo do projeto.

## Stack

| Peça | Escolha | Onde entra / por quê |
|---|---|---|
| Backend | Node + TypeScript + NestJS | Módulos bem separados (carteira, comparador, regras, dados de mercado, recomendações). DI e testes isolam o motor de regras. |
| Banco | PostgreSQL | Dados relacionais (usuários, carteiras, posições, transações, recomendações). `numeric` para dinheiro, `jsonb` para saídas do LLM e premissas. |
| ORM | Prisma (ou Drizzle) | Migrations e tipagem. |
| Cálculos | decimal.js | Evita erro de arredondamento em taxa, IR e rentabilidade. Nunca usar float para dinheiro. |
| Validação | Zod | Valida o que o LLM extrai e o que entra pela API. |
| LLM | API da Anthropic (Claude) | Extrai dados de textos/prints (visão + saída estruturada) e redige explicações. **Não calcula nem decide números.** |
| Agendador | @nestjs/schedule (cron) | Busca índices/cotações em horários fixos; gera relatório mensal. |
| Testes | Vitest | Motor de regras e normalização de taxas precisam de testes. |
| Infra local | Docker Compose | Postgres (e Redis, se necessário). |
| Autenticação | JWT em cookie httpOnly | Ver seção abaixo. |
| Frontend | Projeto separado (React/Next.js), depois do back | O back é estruturado primeiro e exposto via API. |

## Redis

Não no início. Índices (Selic, IPCA, CDI) mudam no máximo diariamente: job agendado busca no BCB e grava em Postgres como série histórica (também serve ao dashboard).

Entra quando houver necessidade de:
- Fila de jobs (BullMQ) para chamadas ao LLM e sincronização de dados; ou
- Cache de cotações, se bater em limite de API.

Alternativa sem Redis: `pg-boss` (fila dentro do Postgres).

## Tempo real

WebSocket **não** é necessário no MVP. Para respostas do LLM que demoram, usar SSE (streaming) ou job assíncrono com polling. WebSocket só se surgir alerta de preço em tempo real.

## Autenticação

- JWT armazenado em **cookie httpOnly** (não acessível por JS), com `Secure` e `SameSite`.
- Access token de curta duração + refresh token com rotação.
- CSRF: cookies `SameSite=Strict` + checagem de `Origin` em POST/PUT/PATCH/DELETE (middleware em `infra/http/middlewares/`). O `refresh_token` só vai para `/sessions`. Exige front no mesmo *site* da API (ver [05](05-decisoes.md)).
- Modelar `userId` em todas as tabelas desde o início.

## Entrada de dados

- **Prioridade 1:** texto colado / formulário e cadastro manual da carteira.
- **Prioridade 2:** imagem (print) enviada ao LLM para extração.
  - Fluxo: LLM extrai → usuário confere e corrige → salva só o dado estruturado + resposta bruta do LLM no log de auditoria.
  - A imagem **não** é armazenada no MVP. Armazenar depois só se fizer falta (conferência/auditoria), em disco local ou S3.
- **Prioridade baixa:** importação de CSV (e integrações B3/Open Finance, mais adiante).

## Log de auditoria

Registrar cada prompt, resposta do LLM, modelo usado, premissas e fontes dos dados. Essencial para o histórico de recomendações e para o caso de virar serviço (ver [03](03-alertas-regulatorios-e-riscos.md)).

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Selic, CDI, IPCA, câmbio | API SGS do BCB | Gratuita e oficial |
| Expectativas de mercado | Relatório Focus (BCB) | Projeções de Selic e IPCA |
| Dados de bancos emissores | IF.data (BCB) | Análise de risco do emissor |
| Ações e FIIs | brapi.dev ou similar | Verificar limites do plano gratuito |
| Cripto | CoinGecko | Gratuita para uso leve |
| Tesouro Direto | Dados abertos do Tesouro | Comparação com CDB |

Acesso por camada de "provedores" com interface própria, para trocar de fonte sem afetar o resto.

## Fluxo geral

```
Entrada (texto/print) → LLM extrai (Zod valida) → usuário confirma
→ motor em código normaliza e compara → regras cruzam com a carteira
→ LLM explica → grava recomendação + premissas + log no Postgres
```

## Arquitetura em camadas (modelo do ZapWave)

Mesma organização do projeto ZapWave (`../ZapWave`, ver `CLAUDE.md` e `docs/04-arquitetura.md` de lá).

```
core   →  não importa nada
domain →  importa só core
infra  →  importa domain e core
test   →  importa core e domain (implementa as MESMAS interfaces do domain)
```

`domain` nunca importa Nest, Prisma, HTTP nem API externa. O que precisa do mundo externo vira **port** (classe abstrata em `applications/`), o `infra` entrega o **adapter** e o `test` entrega um **fake**.

### Por que encaixa aqui

- Motor de regras (comparação, normalização de taxa, IR, concentração) é domínio puro, testável sem rede.
- LLM atrás de um port (`LlmGateway`): fake com resposta fixa nos testes, adapter real chama a API do Claude.
- Provedores de dados atrás de ports (`MarketDataProvider`): troca de fonte e simulação de falha (ex.: BCB fora do ar).
- `Either` nos use-cases: "taxa fora do plausível" ou "dados insuficientes" são resultados esperados, não exceções.

### Contextos do domínio (proposta)

| Contexto | Responsabilidade |
|---|---|
| `accounts` | Cadastro, login, `GET /me` |
| `portfolio` | Carteira, posições, objetivo e perfil |
| `market-data` | Séries de indicadores (Selic, IPCA, CDI) e cotações |
| `comparison` | Comparador de opções (extração, normalização, alertas) |
| `recommendations` | Recomendações, premissas e log de auditoria |

### Reaproveitar / simplificar / deixar de fora

- **Reaproveitar do ZapWave:** `core/` (Either, Entity, erros), `accounts` com JWT em cookie, Prisma, helmet, rate limit, CI.
- **Simplificar:** sem devices (o `deviceId` e o cache de sessão existem por causa do WebSocket); basta access token + refresh token com rotação.
- **Deixar de fora:** contexto `notification` (usuário vai atrás da informação; sem interação entre usuários), Redis e WebSocket.
- **Eventos de domínio** do `core` só entram se surgir caso real (ex.: "relatório mensal pronto", alerta de taxa).

### Quando criar use-case

O critério não é "pode dar erro", e sim se a leitura tem **regra ou orquestração**.

**Use-case (mesmo sendo fetch):**
- Checagem de dono (ex.: buscar minha carteira só devolve a do usuário logado).
- Junta várias fontes ou calcula algo (ex.: resumo da carteira com regras de concentração).
- Tem erro de negócio (`ResourceNotFoundError`, `NotAllowedError`).

**Leitura direta pelo repositório (sem use-case):**
- Leitura pública e trivial, sem dono nem cálculo (ex.: série histórica da Selic para o gráfico).

Regra prática adotada: **use-case para tudo que envolve dado do usuário** (carteira, comparações, recomendações); leitura direta só para dados públicos de mercado. Se o custo em arquivos incomodar, rever; se preferir rigidez total (use-case para tudo), também é válido.

Controller chamando repositório direto **não** quebra a regra de camadas: controller é `infra`, e `infra` pode importar `domain`.

### Onde fica cada peça numa leitura direta

Nada específico de negócio vai para `core` (ele guarda só o genérico: Either, Entity, erros base).

| Camada | O que existe |
|---|---|
| `domain/<contexto>/applications/repositories/` | O **port** (classe abstrata, ex.: `IndicatorRepository`) |
| `infra/database/prisma/repositories/` | O adapter Prisma que implementa o port |
| `infra/http/controllers/` | O controller, que chama o repositório direto |
| `test/repositories/` | In-memory fake, só se algum use-case usar o port |

Testes: sem use-case não há lógica para teste unitário, então o controller é coberto por **e2e** (Postgres real); o adapter Prisma também, se tiver query não trivial. O fake costuma existir de qualquer forma: o port de indicadores será usado pelo comparador (precisa de Selic/CDI para normalizar taxas), que é testado em unitário.
