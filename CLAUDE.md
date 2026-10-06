# CLAUDE.md

Contexto permanente do projeto para o Claude. Leia antes de mexer em qualquer coisa.

## O que é o Help Invest

Assistente de investimentos pessoal com IA. O usuário informa carteira, renda e objetivo; o
sistema cruza isso com o cenário de mercado e devolve sugestões **personalizadas ao momento do
investidor**. Diferencial prioritário: **comparador de opções** (ex.: vários CDBs) que alerta
liquidez, risco do emissor, taxa plausível e pegadinhas.

Estratégia: uso próprio → amigos/família → avaliar virar serviço (regulação CVM, LGPD).

Toda a documentação, decisões e alertas ficam em [`docs/`](./docs/README.md). **Documente
decisões novas lá** (`05-decisoes.md`) e mantenha o índice do README em dia.

| Doc | Assunto |
|-----|---------|
| [`docs/01`](./docs/01-visao-e-diferenciais.md) | visão e diferenciais |
| [`docs/02`](./docs/02-ideia-comparador-de-investimentos.md) | comparador de investimentos |
| [`docs/03`](./docs/03-alertas-regulatorios-e-riscos.md) | CVM, LGPD, riscos do LLM |
| [`docs/04`](./docs/04-roadmap-e-validacao.md) | roadmap e validação |
| [`docs/05`](./docs/05-decisoes.md) | log de decisões |
| [`docs/06`](./docs/06-stack-e-arquitetura.md) | stack, arquitetura, entrada de dados, fontes |
| [`docs/07`](./docs/07-modelo-de-dados.md) | modelo de dados: tabelas, campos, enums, ordem de construção |
| [`docs/08`](./docs/08-casos-de-uso.md) | use-cases essenciais: entrada, saída, erros, ports, ordem |

## Princípios do produto (valem para qualquer código)

- **Números e regras são código; o LLM só extrai entrada e explica.** Nunca deixar o LLM
  calcular taxa, imposto ou concentração.
- Dinheiro e taxas: **decimal.js / `numeric`**, nunca `float`.
- Todo dado de mercado/imposto tem **fonte e data**; todo output do LLM é registrado (auditoria).
- Imagens enviadas **não são armazenadas** no MVP; salva-se o dado extraído + resposta bruta do LLM.
- Modelar `userId` em todas as tabelas de dado do usuário.

## Stack

- **NestJS 11** + **TypeScript** (strict), Node 22 (`.nvmrc`)
- **Prisma** / PostgreSQL (Docker, porta **5433** no host)
- **Zod** para validação; **JWT RS256 em cookie httpOnly** (`access_token`), com fallback Bearer
- **Vitest** — unitários (`src/**/*.spec.ts`, `test/**/*.spec.ts`) e e2e (`src/**/*.e2e-spec.ts`)
- Segurança: `helmet`, CORS restrito (`CORS_ORIGINS`), rate limit (`@nestjs/throttler`)
- Sem Redis e sem WebSocket por decisão (ver `docs/06`); sem contexto `notification`

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm test` | testes unitários |
| `npm run test:e2e` | e2e (precisam de Postgres: `npm run services:up`) |
| `npm run lint` | ESLint com `--fix` |
| `npm run format` | Prettier |
| `npm run start:dev` | API com hot reload (`GET :3333/health`) |
| `npm run services:up` / `services:down` | sobe / derruba o Postgres |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:studio` | Prisma |

Rodar **um arquivo**: `npx vitest run src/core/entities/entity.spec.ts`
(e2e: `npx vitest run --config vitest.config.e2e.ts src/infra/http/controllers/health.e2e-spec.ts`)

No Windows, `prisma generate` pode falhar com EPERM se um processo node (ex.: `nest start`)
estiver segurando a DLL do engine — feche-o antes.

## Arquitetura — regra de dependência (inviolável)

```
core   →  não importa nada
domain →  importa só core
infra  →  importa domain e core
test   →  importa core e domain (implementa as MESMAS interfaces do domain)
```

**`domain` NUNCA importa `infra`, Nest, Prisma, HTTP nem API externa.** Se o domínio precisa do
mundo externo (banco, LLM, provedor de dados), ele declara um **port** (classe abstrata) em
`applications/`, o `infra` fornece o **adapter** e o `test` fornece um **fake**.

Modelo herdado do projeto ZapWave (`../../ZapWave`), adaptado.

### Camadas dentro de `domain/<contexto>/`

- `entities/` — entidades e value objects, JS puro, estendem `Entity<Props>` do core.
  `static create(props, id?)` como construtor.
- `applications/use-cases/` — um caso de uso por arquivo, classe com `execute()`.
- `applications/repositories/` — **classes abstratas** (não `interface`), usadas como token DI.
- `applications/cryptography/`, `applications/gateways/` — outros ports.
- `applications/mappers/`, `applications/dtos/`, `applications/errors/`.

Contextos: `accounts`, `portfolio`, `market-data`, `comparison`, `recommendations`.
Portas previstas: `LlmGateway`, `MarketDataProvider`, repositórios.

### Quando criar use-case

- **Use-case** para tudo que envolve **dado do usuário** (carteira, comparações,
  recomendações): checagem de dono, orquestração, erro de negócio.
- **Leitura direta pelo repositório** (controller → repositório, sem use-case) só para dados
  **públicos de mercado** (ex.: série da Selic). O port continua em `domain`; o controller é
  coberto por e2e.
- Nada específico de negócio vai para `core`.

## Convenções de código

- **Prettier**: sem ponto e vírgula, aspas simples, `trailingComma: es5`, 2 espaços. Rode
  `npm run lint` antes de terminar.
- **Either** para o retorno dos use-cases — nunca `throw` para erro de regra de negócio:
  ```ts
  type FooRes = Either<SomeError, { bar: Baz }>
  // sucesso: return right({ bar })   |   falha: return left(new SomeError())
  ```
  `result.isRight()` / `result.isLeft()` são type guards.
- **Erros de use-case** estendem `Error implements UseCaseError` em `applications/errors/`
  (ou `core/errors/err/` quando genéricos: `ResourceNotFoundError`, `NotAllowedError`,
  `ResourceAlreadyExistsError`).
- **Imports**: `@/*` → `src/*`, `test/*` → `test/*`.
- Injeção via construtor, dependências `private`. Sem decorators no `domain`.

## Convenções de teste

- Vitest com `globals: true`, mas os specs **importam explícito** de `vitest`.
- Nome: `describe('Register User', ...)`, `it('should be able to ...', ...)`.
- A instância sob teste chama-se `sut`, montada em `beforeEach`.
- Sem banco/rede em teste unitário: usar fakes/in-memory de `test/`:
  `test/repositories/in-memory-*`, `test/gateways/` (ex.: fake do LLM e do provedor de dados),
  `test/cryptography/` (`FakeHasher`, `FakeEncrypter`), `test/factories/make-*.ts` (faker).
- Cada novo port precisa de um fake/in-memory em `test/`.
- **e2e** (`*.e2e-spec.ts`, ao lado do controller/adapter): sobem o `AppModule` contra Postgres
  real, cada arquivo em um schema próprio (`test/setup-e2e.ts`). Monte o app com
  `configureApp(app)` (`src/infra/setup-app.ts`). O setup desliga o rate limit.

## Estado atual

Existem: configs, `core` (Either, Entity, UniqueEntityId, erros, Optional), infra base (env,
auth JWT com cookie, criptografia bcrypt/JWT, pipe Zod, `GET /health`, CI) e o **modelo de dados
do MVP** ([`docs/07`](./docs/07-modelo-de-dados.md)):

- `prisma/schema.prisma` com as 8 tabelas e enums (ainda **sem migration** gerada).
- Entidades em `src/domain/<contexto>/entities/` + factories em `test/factories/make-*.ts`.
- Enums do domínio são objetos `as const` com os **mesmos valores** dos enums do Prisma
  (o domínio não importa o Prisma). Enums usados por mais de um contexto ficam em
  `src/domain/shared/enums/`; os de um contexto só, em `<contexto>/entities/enums/`.
- Valores monetários e taxas nas entidades são `Decimal` do `decimal.js`.

Use-cases: implementados um a um conforme [`docs/08`](./docs/08-casos-de-uso.md) (só domínio +
in-memory, **sem controller** por enquanto). Feito: UC-01 `RegisterUser`, UC-02 `Authenticate`, UC-03 `RefreshSession`, UC-04 `Logout`, UC-05 `GetCurrentUser` (bloco accounts completo), UC-06 `SaveInvestorProfile`, UC-07 `GetInvestorProfile`, UC-08 `CreatePosition`, UC-09 `EditPosition`, UC-10 `DeletePosition`, UC-11 `ListPositions`.

**Ainda não existem:** migration, mappers, adapters Prisma dos repositórios, demais use-cases,
refresh token, controllers de negócio. Tabelas **novas** continuam sendo definidas em conjunto
com o autor — não criar models ou entidades fora do `docs/07` por conta própria.

Auth hoje: access token curto (`JWT_EXPIRES_IN`, padrão 15m) sem checagem de sessão no banco;
refresh token com rotação e proteção CSRF entram junto com as tabelas de usuário/sessão.
