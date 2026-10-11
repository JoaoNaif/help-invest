import Anthropic from '@anthropic-ai/sdk'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { Either, left, right } from '@/core/either'
import { ComparisonExplanationInput } from '@/domain/comparison/applications/dtos/comparison-explanation-input'
import { ComparisonOptionInput } from '@/domain/comparison/applications/dtos/comparison-option-input'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import {
  ExplainComparisonResult,
  ExplainPortfolioResult,
  ExtractionSource,
  ExtractOptionsResult,
  LlmCall,
  LlmGateway,
} from '@/domain/comparison/applications/gateways/llm-gateway'
import { PortfolioExplanationInput } from '@/domain/portfolio-analysis/applications/dtos/portfolio-explanation-input'
import { AssetClass } from '@/domain/portfolio-analysis/entities/enums/asset-class'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

const EXTRACTION_MAX_TOKENS = 8_000
const EXPLANATION_MAX_TOKENS = 4_000

const EXTRACTION_SYSTEM_PROMPT = `Você extrai opções de investimento de renda fixa de um texto ou de um print (ex.: tela de corretora ou banco).

Regras:
- Extraia só o que está explícito. Nunca invente nem estime valores; o que não aparece fica null.
- Uma entrada em "options" por produto listado.
- "assetType": CDB, LCI, LCA, LC, TESOURO, DEBENTURE, CRI, CRA, ACAO, FII, FUNDO, CRIPTO ou OUTRO.
- "indexer" e "rate":
  - "110% do CDI" -> indexer CDI, rate 110
  - "IPCA + 6,5%" -> indexer IPCA, rate 6.5
  - "14,2% a.a." ou prefixado -> indexer PRE, rate 14.2
  - "Selic + 0,1%" -> indexer SELIC, rate 0.1
- "maturityAt": vencimento no formato YYYY-MM-DD.
- "liquidity": DAILY (resgate diário), AT_MATURITY (só no vencimento) ou GRACE_PERIOD (liquidez diária após carência; informe a carência em "graceDays").
- "issuerCnpj": só dígitos, se aparecer.
- "minAmount": aplicação mínima em reais, número sem formatação.
- "rawInput": o trecho original de onde a opção saiu.
- Não calcule rentabilidade, imposto nem comparações.`

const EXPLANATION_SYSTEM_PROMPT = `Você ajuda uma pessoa física a escolher entre opções de renda fixa, em português do Brasil e em linguagem simples (ela entende de investir, mas não é especialista).

Os números e alertas já foram calculados por um motor de regras. Use-os exatamente como recebidos; nunca recalcule, arredonde, converta nem invente valores ou fatos sobre os emissores.

Devolva:
- "summary": 2 a 3 frases com o resultado (qual ficou em 1º lugar e o ponto de atenção mais importante).
- "bestOptionId": o "optionId" da opção que mais combina com o objetivo, ou null se nenhuma se destaca.
- "bestReason": por que essa opção combina com o objetivo (1 a 2 frases). null se bestOptionId for null.
- "options": uma entrada para CADA opção recebida, com o "optionId" dela, "pros" (2 a 3 itens curtos) e "cons" (2 a 3 itens curtos).

Como escolher a opção indicada:
- Se "goal" vier preenchido, ele manda: RESERVE (reserva: liquidez e segurança pesam mais que taxa), RETIREMENT (aposentadoria: longo prazo, proteção da inflação), PURCHASE (compra planejada: o vencimento precisa caber no prazo), GROWTH (crescimento: taxa líquida pesa mais, com risco aceitável).
- Sem "goal", use o perfil do investidor (tolerância a risco, horizonte); sem perfil, indique pela maior taxa líquida.
- Os alertas contam: não indique uma opção com alerta DANGER se houver alternativa razoável.

Estilo:
- Itens curtos, objetivos, sem emojis, sem repetir o texto dos alertas palavra por palavra.
- Fale em "combina mais com o seu objetivo", nunca em ordem do tipo "você deve investir".
- Não inclua aviso legal nos textos: a tela já mostra que é informação e não recomendação.`

const PORTFOLIO_EXPLANATION_SYSTEM_PROMPT = `Você ajuda uma pessoa física a entender a situação da carteira dela frente ao seu perfil e ao cenário de juros, em português do Brasil e em linguagem simples (ela entende de investir, mas não é especialista).

A análise já foi calculada por um motor de regras: faixas-alvo por classe de ativo, distância da carteira até cada faixa, cenário de juros e alertas. Use tudo exatamente como recebido; nunca recalcule, arredonde, converta nem invente números, taxas ou fatos de mercado.

Devolva:
- "summary": 2 a 3 frases com o retrato geral (onde a carteira está mais distante da faixa-alvo e o que o cenário de juros e a estratégia escolhida acrescentam).
- "highlights": até 3 itens, cada um com "assetClass" (exatamente um dos valores recebidos em "paths") e "text" (1 a 2 frases sobre aquela classe, a partir dos motivos e riscos dela).
- "attentionPoints": até 3 pontos curtos de atenção, a partir dos alertas (por código), da reserva de emergência e dos riscos.

Regras:
- A estratégia escolhida ("strategy") e o perfil ("investor") orientam o que destacar. Com "isDefault" verdadeiro, avise que o perfil ainda não foi preenchido e que valem premissas padrão.
- Fale de classes de ativo (renda fixa pós-fixada, ações, fundos imobiliários...). Nunca cite produto, ticker, banco ou emissor.
- Nunca diga "compre", "venda", "invista" nem dê ordem. Descreva a situação: "está abaixo da faixa-alvo", "tem espaço", "está acima".
- "direction" INCREASE = abaixo da faixa; REDUCE = acima da faixa; MAINTAIN = dentro da faixa.
- Itens curtos, sem emojis, sem repetir os textos dos motivos palavra por palavra.
- Não inclua aviso legal: a tela já mostra que é informação e não recomendação.`

const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['options'],
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'assetType',
          'indexer',
          'rate',
          'issuerName',
          'issuerCnpj',
          'maturityAt',
          'liquidity',
          'graceDays',
          'minAmount',
          'rawInput',
        ],
        properties: {
          assetType: { type: 'string', enum: Object.values(AssetType) },
          indexer: { type: 'string', enum: Object.values(Indexer) },
          rate: { type: 'number' },
          issuerName: { type: ['string', 'null'] },
          issuerCnpj: { type: ['string', 'null'] },
          maturityAt: { type: ['string', 'null'] },
          liquidity: {
            anyOf: [
              { type: 'string', enum: Object.values(Liquidity) },
              { type: 'null' },
            ],
          },
          graceDays: { type: ['integer', 'null'] },
          minAmount: { type: ['number', 'null'] },
          rawInput: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const

const explanationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'bestOptionId', 'bestReason', 'options'],
  properties: {
    summary: { type: 'string' },
    bestOptionId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    bestReason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['optionId', 'pros', 'cons'],
        properties: {
          optionId: { type: 'string' },
          pros: { type: 'array', items: { type: 'string' } },
          cons: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

const portfolioExplanationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'attentionPoints'],
  properties: {
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['assetClass', 'text'],
        properties: {
          assetClass: { type: 'string', enum: Object.values(AssetClass) },
          text: { type: 'string' },
        },
      },
    },
    attentionPoints: { type: 'array', items: { type: 'string' } },
  },
} as const

// A saída do LLM nunca é confiada: passa por aqui antes de virar domínio.
const extractedOptionsSchema = z.object({
  options: z.array(
    z.object({
      assetType: z.nativeEnum(AssetType),
      indexer: z.nativeEnum(Indexer),
      rate: z.number().positive(),
      issuerName: z.string().trim().min(1).nullable(),
      issuerCnpj: z
        .string()
        .nullable()
        .transform((value) => {
          const digits = value?.replace(/\D/g, '') ?? ''

          return digits.length === 14 ? digits : null
        }),
      maturityAt: z
        .string()
        .date()
        .nullable()
        .transform((value) => (value ? new Date(value) : null)),
      liquidity: z.nativeEnum(Liquidity).nullable(),
      graceDays: z.number().int().nonnegative().nullable(),
      minAmount: z.number().nonnegative().nullable(),
      rawInput: z.string().nullable(),
    })
  ),
})

const explanationSchema = z.object({
  summary: z.string().trim().min(1),
  bestOptionId: z.string().nullable(),
  bestReason: z.string().nullable(),
  options: z.array(
    z.object({
      optionId: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    })
  ),
})

// Classe inventada pelo LLM invalida o item (o domínio descarta o resto).
const portfolioExplanationSchema = z.object({
  summary: z.string().trim().min(1),
  highlights: z.array(
    z.object({
      assetClass: z.nativeEnum(AssetClass),
      text: z.string(),
    })
  ),
  attentionPoints: z.array(z.string()),
})

/**
 * Adapter do `LlmGateway` na API da Anthropic. O LLM só extrai e redige;
 * número, taxa e alerta continuam sendo do motor de regras.
 * Falha de rede/API vira `left(LlmUnavailableError)`; resposta inválida vira
 * `options`/`explanation = null` (o use-case registra e trata).
 */
export class AnthropicLlmGateway implements LlmGateway {
  constructor(
    private client: Anthropic,
    private model: string
  ) {}

  async extractOptions(
    source: ExtractionSource
  ): Promise<Either<LlmUnavailableError, ExtractOptionsResult>> {
    const content: Anthropic.ContentBlockParam[] =
      source.type === 'text'
        ? [{ type: 'text', text: source.text }]
        : [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: source.mediaType,
                data: source.base64,
              },
            },
            { type: 'text', text: 'Extraia as opções de investimento.' },
          ]

    // O prompt gravado não leva a imagem (não é armazenada).
    const prompt =
      source.type === 'text'
        ? `${EXTRACTION_SYSTEM_PROMPT}\n\n${source.text}`
        : `${EXTRACTION_SYSTEM_PROMPT}\n\n[imagem omitida]`

    const response = await this.send({
      system: EXTRACTION_SYSTEM_PROMPT,
      content,
      maxTokens: EXTRACTION_MAX_TOKENS,
      format: extractionJsonSchema,
    })

    if (response.isLeft()) {
      return left(response.value)
    }

    const message = response.value
    const call = this.toCall(message, prompt)

    return right({ call, options: this.parseOptions(message) })
  }

  async explainComparison(
    input: ComparisonExplanationInput
  ): Promise<Either<LlmUnavailableError, ExplainComparisonResult>> {
    const userText = JSON.stringify(input, null, 2)

    const response = await this.send({
      system: EXPLANATION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: userText }],
      maxTokens: EXPLANATION_MAX_TOKENS,
      format: explanationJsonSchema,
    })

    if (response.isLeft()) {
      return left(response.value)
    }

    const message = response.value
    return right({
      call: this.toCall(message, `${EXPLANATION_SYSTEM_PROMPT}\n\n${userText}`),
      explanation: this.parseExplanation(message),
    })
  }

  async explainPortfolio(
    input: PortfolioExplanationInput
  ): Promise<Either<LlmUnavailableError, ExplainPortfolioResult>> {
    const userText = JSON.stringify(input, null, 2)

    const response = await this.send({
      system: PORTFOLIO_EXPLANATION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: userText }],
      maxTokens: EXPLANATION_MAX_TOKENS,
      format: portfolioExplanationJsonSchema,
    })

    if (response.isLeft()) {
      return left(response.value)
    }

    const message = response.value
    const parsed = portfolioExplanationSchema.safeParse(this.readJson(message))

    return right({
      call: this.toCall(
        message,
        `${PORTFOLIO_EXPLANATION_SYSTEM_PROMPT}

${userText}`
      ),
      explanation: parsed.success ? parsed.data : null,
    })
  }

  private async send({
    system,
    content,
    maxTokens,
    format,
  }: {
    system: string
    content: Anthropic.ContentBlockParam[]
    maxTokens: number
    format?: Record<string, unknown>
  }): Promise<Either<LlmUnavailableError, Anthropic.Message>> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
        // Tarefas curtas e guiadas: esforço baixo basta e sai mais barato.
        output_config: {
          effort: 'low',
          ...(format && {
            format: { type: 'json_schema', schema: format },
          }),
        },
      })

      return right(message)
    } catch (error) {
      // Só falha da API/rede vira "indisponível"; bug nosso continua subindo.
      if (error instanceof Anthropic.APIError) {
        return left(new LlmUnavailableError())
      }

      throw error
    }
  }

  private parseExplanation(message: Anthropic.Message) {
    const json = this.readJson(message)
    const parsed = explanationSchema.safeParse(json)

    return parsed.success ? parsed.data : null
  }

  /** Só uma resposta que terminou normalmente vale (nada cortado nem recusado). */
  private readJson(message: Anthropic.Message): unknown {
    if (message.stop_reason !== 'end_turn') {
      return null
    }

    try {
      return JSON.parse(readText(message))
    } catch {
      return null
    }
  }

  private parseOptions(message: Anthropic.Message) {
    const parsed = extractedOptionsSchema.safeParse(this.readJson(message))

    if (!parsed.success) {
      return null
    }

    return parsed.data.options.map((option): ComparisonOptionInput => ({
      ...option,
      rate: new Decimal(option.rate),
      minAmount:
        option.minAmount === null ? null : new Decimal(option.minAmount),
    }))
  }

  private toCall(message: Anthropic.Message, prompt: string): LlmCall {
    return {
      model: message.model,
      prompt,
      rawResponse: {
        stopReason: message.stop_reason,
        content: message.content,
      },
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }
  }
}

function readText(message: Anthropic.Message) {
  return message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
}
