import Anthropic from '@anthropic-ai/sdk'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { Either, left, right } from '@/core/either'
import { ComparisonExplanationInput } from '@/domain/comparison/applications/dtos/comparison-explanation-input'
import { ComparisonOptionInput } from '@/domain/comparison/applications/dtos/comparison-option-input'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import {
  ExplainComparisonResult,
  ExtractionSource,
  ExtractOptionsResult,
  LlmCall,
  LlmGateway,
} from '@/domain/comparison/applications/gateways/llm-gateway'
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

const EXPLANATION_SYSTEM_PROMPT = `Você explica, em português do Brasil e em linguagem simples, o resultado de uma comparação de investimentos de renda fixa para uma pessoa física.

Regras:
- Os números e alertas já foram calculados por um motor de regras. Use-os exatamente como recebidos; nunca recalcule, arredonde, converta nem invente valores.
- Explique qual opção ficou em 1º lugar e por quê, depois destaque os alertas de cada opção (liquidez, risco do emissor, limite do FGC, pegadinhas) e o que eles significam na prática.
- Se houver dados do investidor (objetivo, tolerância a risco, horizonte), relacione-os às opções.
- Seja direto: até 250 palavras, sem títulos, sem tabelas, sem emojis.
- É informação, não recomendação personalizada de investimento. Termine com uma frase curta lembrando que a decisão é do investidor.`

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
    })

    if (response.isLeft()) {
      return left(response.value)
    }

    const message = response.value
    const text = message.stop_reason === 'refusal' ? '' : readText(message)

    return right({
      call: this.toCall(message, `${EXPLANATION_SYSTEM_PROMPT}\n\n${userText}`),
      explanation: text.trim() ? text.trim() : null,
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
    format?: typeof extractionJsonSchema
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

  private parseOptions(message: Anthropic.Message) {
    if (message.stop_reason !== 'end_turn') {
      return null
    }

    let json: unknown

    try {
      json = JSON.parse(readText(message))
    } catch {
      return null
    }

    const parsed = extractedOptionsSchema.safeParse(json)

    if (!parsed.success) {
      return null
    }

    return parsed.data.options.map(
      (option): ComparisonOptionInput => ({
        ...option,
        rate: new Decimal(option.rate),
        minAmount:
          option.minAmount === null ? null : new Decimal(option.minAmount),
      })
    )
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
