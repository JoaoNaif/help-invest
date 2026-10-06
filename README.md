# Help Invest — backend

Assistente de investimentos pessoal com IA: cruza a carteira e o objetivo do usuário com o cenário de mercado (Selic, IPCA, bolsas, cripto) e compara opções de investimento (ex.: vários CDBs), alertando liquidez, risco e pegadinhas.

Visão, diferenciais, decisões e riscos ficam em [`docs/`](./docs/README.md).

## Stack

- **NestJS 11** + **TypeScript**
- **Prisma** (PostgreSQL)
- **Zod** (validação), **JWT em cookie httpOnly** (auth)
- **Vitest** — testes unitários e e2e

## Pré-requisitos

- Node.js 22 (ver `.nvmrc`)
- Docker + Docker Compose (Postgres)

## Setup

```bash
# 1. variáveis de ambiente (gerar o par de chaves JWT — ver .env.example)
cp .env.example .env        # no Windows: copy .env.example .env

# 2. dependências
npm install

# 3. sobe o Postgres (porta 5433 no host)
npm run services:up

# 4. API em modo watch
npm run start:dev
```

Verificação rápida: `GET http://localhost:3333/health` → `{ "status": "ok" }`

## Scripts

| Script | O que faz |
|--------|-----------|
| `npm run start:dev` | API com hot reload |
| `npm run services:up` / `services:down` | sobe / derruba o Postgres (Docker) |
| `npm run prisma:generate` | gera o Prisma Client |
| `npm run prisma:migrate` | cria/aplica migrations (quando houver models) |
| `npm run prisma:studio` | abre o Prisma Studio |
| `npm test` | testes unitários (`src/**/*.spec.ts`) |
| `npm run test:e2e` | testes e2e (precisam do Postgres no ar) |
| `npm run lint` | ESLint com `--fix` |
| `npm run format` | Prettier |

## Estrutura

Camadas `core` / `domain` / `infra` com regra de dependência estrita (ver [`docs/06`](./docs/06-stack-e-arquitetura.md)).

```
src/
  core/     # shared kernel: Either, Entity, UniqueEntityId, erros genéricos
  domain/   # contextos: accounts, portfolio, market-data, comparison, recommendations
  infra/    # Nest, Prisma, auth, HTTP, env
test/       # fakes, in-memory repositories, factories, setup e2e
prisma/
docs/
```
