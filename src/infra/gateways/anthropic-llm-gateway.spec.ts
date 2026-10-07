import Anthropic from '@anthropic-ai/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import { AnthropicLlmGateway } from './anthropic-llm-gateway'

function makeMessage(
  text: string,
  overrides: Partial<Anthropic.Message> = {}
): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 40 },
    ...overrides,
  } as Anthropic.Message
}

const validOption = {
  assetType: 'CDB',
  indexer: 'CDI',
  rate: 110,
  issuerName: 'Banco X',
  issuerCnpj: '12.345.678/0001-99',
  maturityAt: '2028-03-15',
  liquidity: 'AT_MATURITY',
  graceDays: null,
  minAmount: 1000,
  rawInput: 'CDB Banco X 110% CDI',
}

describe('Anthropic LLM Gateway', () => {
  let create: ReturnType<typeof vi.fn>
  let sut: AnthropicLlmGateway

  beforeEach(() => {
    create = vi.fn()
    sut = new AnthropicLlmGateway(
      { messages: { create } } as unknown as Anthropic,
      'claude-sonnet-5-5'
    )
  })

  it('should be able to extract options from text', async () => {
    create.mockResolvedValue(
      makeMessage(JSON.stringify({ options: [validOption] }))
    )

    const result = await sut.extractOptions({ type: 'text', text: 'CDB X' })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const [option] = result.value.options!

      expect(option.rate.toString()).toBe('110')
      expect(option.minAmount?.toString()).toBe('1000')
      expect(option.issuerCnpj).toBe('12345678000199')
      expect(option.maturityAt).toEqual(new Date('2028-03-15'))
      expect(result.value.call).toEqual(
        expect.objectContaining({
          model: 'claude-sonnet-5-5',
          inputTokens: 100,
          outputTokens: 40,
        })
      )
    }
  })

  it('should send the image to the LLM but not keep it in the prompt', async () => {
    create.mockResolvedValue(
      makeMessage(JSON.stringify({ options: [validOption] }))
    )

    const result = await sut.extractOptions({
      type: 'image',
      base64: 'AAAA',
      mediaType: 'image/png',
    })

    const request = create.mock.calls[0][0]

    expect(request.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
    })
    expect(result.isRight() && result.value.call.prompt).not.toContain('AAAA')
  })

  it('should drop a CNPJ that does not have 14 digits', async () => {
    create.mockResolvedValue(
      makeMessage(
        JSON.stringify({
          options: [{ ...validOption, issuerCnpj: '123' }],
        })
      )
    )

    const result = await sut.extractOptions({ type: 'text', text: 'CDB X' })

    expect(result.isRight() && result.value.options![0].issuerCnpj).toBeNull()
  })

  it.each([
    ['not json', 'isto não é json'],
    [
      'invalid enum',
      JSON.stringify({ options: [{ ...validOption, assetType: 'POUPANCA' }] }),
    ],
    [
      'non-positive rate',
      JSON.stringify({ options: [{ ...validOption, rate: 0 }] }),
    ],
    [
      'invalid date',
      JSON.stringify({ options: [{ ...validOption, maturityAt: '15/03/2028' }] }),
    ],
  ])('should return null options on %s, keeping the raw response', async (_, text) => {
    create.mockResolvedValue(makeMessage(text))

    const result = await sut.extractOptions({ type: 'text', text: 'CDB X' })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.options).toBeNull()
      expect(result.value.call.rawResponse).toBeDefined()
    }
  })

  it('should return null options when the answer was cut or refused', async () => {
    create.mockResolvedValue(
      makeMessage(JSON.stringify({ options: [validOption] }), {
        stop_reason: 'max_tokens',
      })
    )

    const result = await sut.extractOptions({ type: 'text', text: 'CDB X' })

    expect(result.isRight() && result.value.options).toBeNull()
  })

  it('should be able to explain a comparison', async () => {
    create.mockResolvedValue(makeMessage('  A opção 1 rende mais.  '))

    const result = await sut.explainComparison({
      amount: '5000',
      horizonMonths: 24,
      options: [],
      assumptions: {},
      investor: null,
    })

    expect(result.isRight() && result.value.explanation).toBe(
      'A opção 1 rende mais.'
    )
    // os números vão ao LLM como texto exato
    expect(create.mock.calls[0][0].messages[0].content[0].text).toContain(
      '"amount": "5000"'
    )
  })

  it('should return a null explanation when the answer is empty or refused', async () => {
    create.mockResolvedValue(makeMessage('   '))

    const empty = await sut.explainComparison({
      amount: '1',
      horizonMonths: 1,
      options: [],
      assumptions: {},
      investor: null,
    })

    create.mockResolvedValue(
      makeMessage('texto', { stop_reason: 'refusal' })
    )

    const refused = await sut.explainComparison({
      amount: '1',
      horizonMonths: 1,
      options: [],
      assumptions: {},
      investor: null,
    })

    expect(empty.isRight() && empty.value.explanation).toBeNull()
    expect(refused.isRight() && refused.value.explanation).toBeNull()
  })

  it('should return LlmUnavailableError when the API fails', async () => {
    create.mockRejectedValue(
      new Anthropic.APIConnectionError({ message: 'network down' })
    )

    const extraction = await sut.extractOptions({ type: 'text', text: 'x' })

    expect(extraction.isLeft()).toBe(true)
    expect(extraction.value).toBeInstanceOf(LlmUnavailableError)

    const explanation = await sut.explainComparison({
      amount: '1',
      horizonMonths: 1,
      options: [],
      assumptions: {},
      investor: null,
    })

    expect(explanation.value).toBeInstanceOf(LlmUnavailableError)
  })

  it('should not hide programming errors as unavailable', async () => {
    create.mockRejectedValue(new TypeError('bug'))

    await expect(
      sut.extractOptions({ type: 'text', text: 'x' })
    ).rejects.toThrow(TypeError)
  })
})
