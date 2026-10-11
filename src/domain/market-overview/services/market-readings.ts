import Decimal from 'decimal.js'
import {
  MarketScenario,
  REAL_RATE_HIGH_PERCENT,
  REAL_RATE_LOW_PERCENT,
  ScenarioBias,
  SELIC_TREND_MONTHS,
  SELIC_TREND_THRESHOLD_PP,
} from '@/domain/portfolio-analysis/services/market-scenario'
import { SelicTrend } from '@/domain/portfolio-analysis/entities/enums/selic-trend'
import { INCOME_TAX_BRACKETS } from '@/domain/shared/constants/income-tax'
import { formatPercent } from '@/domain/shared/format'
import {
  IndexReading,
  MarketReadingItem,
  OverviewNote,
} from '../applications/dtos/market-overview'
import {
  INDEX_MOVING_AVERAGE_DAYS,
  INDEX_RETURN_MONTHS,
  IndexTrendDirection,
} from './index-trend'
import { ReadingTopic } from '../entities/enums/reading-topic'
import { Stance } from '../entities/enums/stance'

/**
 * Contexto de preço de um índice para a leitura de ações/FIIs. É só contexto:
 * nunca muda o `stance`, que vem dos juros.
 */
export interface IndexContext {
  /** Nome para o texto: "Ibovespa" ou "IFIX". */
  name: string
  /** `null` = indisponível (ver `unavailableDetail`). */
  reading: IndexReading | null
  unavailableDetail?: string
}

export interface MarketReadingsInput {
  /** `null` em qualquer um = dado indisponível (a regra que o usa não dispara). */
  selic: Decimal | null
  ipca12m: Decimal | null
  realRate: Decimal | null
  trend: SelicTrend | null
  /** Opcional: sem ele a leitura de ações/FIIs vem só dos juros (Fase A). */
  indices?: {
    [ReadingTopic.STOCKS]: IndexContext
    [ReadingTopic.REAL_ESTATE_FUNDS]: IndexContext
  }
}

/** Ordem de exibição das leituras. */
export const READING_ORDER: readonly ReadingTopic[] = [
  ReadingTopic.FIXED_POST,
  ReadingTopic.FIXED_PRE,
  ReadingTopic.FIXED_INFLATION,
  ReadingTopic.TAX_EXEMPT,
  ReadingTopic.STOCKS,
  ReadingTopic.REAL_ESTATE_FUNDS,
]

/** Juro real mínimo para a leitura de prefixados (trava de taxa antes da queda). */
const PRE_MIN_REAL_RATE_PERCENT = REAL_RATE_LOW_PERCENT

const note = (code: string, message: string): OverviewNote => ({
  code,
  message,
})

/**
 * Leitura do cenário de juros por tópico — pura, determinística, sem LLM.
 * Descreve o cenário; nunca manda comprar ou vender. Regras (regra do
 * produto, não norma; limiares em constantes nomeadas):
 *
 * | tópico | FAVORED | LESS_FAVORED |
 * |---|---|---|
 * | FIXED_POST | juro real alto e Selic ≠ caindo; ou Selic subindo | juro real baixo; ou Selic caindo com juro real abaixo do alto |
 * | FIXED_INFLATION | juro real alto (mais forte com Selic caindo) | juro real baixo |
 * | FIXED_PRE | Selic caindo e juro real ≥ baixo | Selic subindo |
 * | TAX_EXEMPT | igual a FIXED_POST | igual a FIXED_POST |
 * | STOCKS / REAL_ESTATE_FUNDS | `bias` = FAVOR_VARIABLE | `bias` = FAVOR_FIXED |
 *
 * Precedência: quando as duas pontas disparam, `LESS_FAVORED` vence (mesma
 * ordem do `MarketScenario.assess`, em que juro real baixo vem primeiro).
 * Sem a entrada principal da regra: `UNAVAILABLE`, nunca zero.
 */
export class MarketReadings {
  static build(input: MarketReadingsInput): MarketReadingItem[] {
    const post = fixedPost(input)

    const byTopic: Record<ReadingTopic, MarketReadingItem> = {
      [ReadingTopic.FIXED_POST]: post,
      [ReadingTopic.FIXED_PRE]: fixedPre(input),
      [ReadingTopic.FIXED_INFLATION]: fixedInflation(input),
      [ReadingTopic.TAX_EXEMPT]: taxExempt(input, post),
      [ReadingTopic.STOCKS]: withIndexContext(
        variableIncome(ReadingTopic.STOCKS, input),
        input.indices?.[ReadingTopic.STOCKS]
      ),
      [ReadingTopic.REAL_ESTATE_FUNDS]: withIndexContext(
        variableIncome(ReadingTopic.REAL_ESTATE_FUNDS, input),
        input.indices?.[ReadingTopic.REAL_ESTATE_FUNDS]
      ),
    }

    return READING_ORDER.map((topic) => byTopic[topic])
  }
}

function isHigh({ realRate }: MarketReadingsInput) {
  return (
    realRate !== null && realRate.greaterThanOrEqualTo(REAL_RATE_HIGH_PERCENT)
  )
}

function isLow({ realRate }: MarketReadingsInput) {
  return realRate !== null && realRate.lessThan(REAL_RATE_LOW_PERCENT)
}

function trendLabel(trend: SelicTrend | null) {
  switch (trend) {
    case SelicTrend.FALLING:
      return 'em queda'
    case SelicTrend.RISING:
      return 'em alta'
    case SelicTrend.STABLE:
      return 'estável'
    default:
      return 'indisponível'
  }
}

/** Primeira razão de toda leitura: os números usados. */
function numbersReason({
  selic,
  ipca12m,
  realRate,
  trend,
}: MarketReadingsInput): OverviewNote {
  const parts: string[] = []

  if (selic) parts.push(`Selic ${formatPercent(selic, 2)}`)
  if (ipca12m) parts.push(`IPCA 12m ${formatPercent(ipca12m, 2)}`)
  if (realRate) parts.push(`juro real ${formatPercent(realRate, 2)} a.a.`)
  if (trend) parts.push(`tendência da Selic ${trendLabel(trend)}`)

  return parts.length === 0
    ? note(
        'DATA_UNAVAILABLE',
        'Sem Selic nem IPCA recentes: não há números para esta leitura.'
      )
    : note('MARKET_NUMBERS', `${parts.join(', ')}.`)
}

function missing(message: string): OverviewNote {
  return note('DATA_UNAVAILABLE', message)
}

function premise(code: 'HIGH' | 'LOW' | 'TREND'): OverviewNote {
  switch (code) {
    case 'HIGH':
      return note(
        'REAL_RATE_HIGH_THRESHOLD',
        `Juro real a partir de ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)} é considerado alto.`
      )
    case 'LOW':
      return note(
        'REAL_RATE_LOW_THRESHOLD',
        `Juro real abaixo de ${formatPercent(REAL_RATE_LOW_PERCENT, 0)} é considerado baixo.`
      )
    default:
      return note(
        'SELIC_TREND_WINDOW',
        `Tendência compara a Selic de hoje com a de ~${SELIC_TREND_MONTHS} meses atrás; variação de ${SELIC_TREND_THRESHOLD_PP.toString().replace('.', ',')} ponto percentual ou mais conta como alta ou queda.`
      )
  }
}

const REAL_RATE_FORMULA_PREMISE = note(
  'REAL_RATE_FORMULA',
  'Juro real aproximado: (1 + Selic meta) / (1 + IPCA acumulado em 12 meses) − 1.'
)

function item(
  topic: ReadingTopic,
  stance: Stance,
  reasons: OverviewNote[],
  premises: OverviewNote[]
): MarketReadingItem {
  return { topic, stance, reasons, premises }
}

function fixedPost(input: MarketReadingsInput): MarketReadingItem {
  const { realRate, trend } = input
  const topic = ReadingTopic.FIXED_POST
  const premises = [
    REAL_RATE_FORMULA_PREMISE,
    premise('HIGH'),
    premise('LOW'),
    premise('TREND'),
  ]
  const reasons = [numbersReason(input)]
  const real = realRate ? formatPercent(realRate, 2) : null

  // LESS_FAVORED vence quando as duas pontas disparam.
  if (isLow(input)) {
    reasons.push(
      note(
        'LOW_REAL_RATE',
        `Com juro real de ${real} a.a., abaixo do limiar de ${formatPercent(REAL_RATE_LOW_PERCENT, 0)}, o pós-fixado rende pouco acima da inflação.`
      )
    )

    return item(topic, Stance.LESS_FAVORED, reasons, premises)
  }

  if (trend === SelicTrend.FALLING && realRate && !isHigh(input)) {
    reasons.push(
      note(
        'SELIC_FALLING',
        `Selic em queda com juro real de ${real} a.a., que não é alto: o pós-fixado tende a render menos.`
      )
    )

    return item(topic, Stance.LESS_FAVORED, reasons, premises)
  }

  const favorable: OverviewNote[] = []

  if (isHigh(input) && trend !== SelicTrend.FALLING) {
    favorable.push(
      note(
        'HIGH_REAL_RATE',
        `Juro real de ${real} a.a., a partir de ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)}: o pós-fixado paga bem acima da inflação.`
      )
    )
  }

  if (trend === SelicTrend.RISING) {
    favorable.push(
      note(
        'SELIC_RISING',
        'Selic em alta: o pós-fixado acompanha a subida dos juros.'
      )
    )
  }

  if (favorable.length > 0) {
    return item(topic, Stance.FAVORED, [...reasons, ...favorable], premises)
  }

  if (realRate === null) {
    return item(
      topic,
      Stance.UNAVAILABLE,
      [
        ...reasons,
        missing('Sem Selic ou IPCA recentes para calcular o juro real.'),
      ],
      premises
    )
  }

  if (isHigh(input)) {
    reasons.push(
      note(
        'HIGH_REAL_RATE_FALLING_SELIC',
        `Juro real alto (${real} a.a.), mas com a Selic em queda o pós-fixado deve render menos adiante: leitura neutra.`
      )
    )
  } else {
    reasons.push(
      note(
        'REAL_RATE_BETWEEN_THRESHOLDS',
        `Juro real de ${real} a.a. entre ${formatPercent(REAL_RATE_LOW_PERCENT, 0)} e ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)} e sem direção clara da Selic: leitura neutra.`
      )
    )
  }

  return item(topic, Stance.NEUTRAL, reasons, premises)
}

function fixedInflation(input: MarketReadingsInput): MarketReadingItem {
  const { realRate, trend } = input
  const topic = ReadingTopic.FIXED_INFLATION
  const premises = [
    REAL_RATE_FORMULA_PREMISE,
    premise('HIGH'),
    premise('LOW'),
    premise('TREND'),
  ]
  const reasons = [numbersReason(input)]

  if (realRate === null) {
    return item(
      topic,
      Stance.UNAVAILABLE,
      [
        ...reasons,
        missing('Sem Selic ou IPCA recentes para calcular o juro real.'),
      ],
      premises
    )
  }

  const real = formatPercent(realRate, 2)

  if (isLow(input)) {
    reasons.push(
      note(
        'LOW_REAL_RATE',
        `Com juro real de ${real} a.a., abaixo de ${formatPercent(REAL_RATE_LOW_PERCENT, 0)}, a taxa real que o IPCA+ fixa é baixa.`
      )
    )

    return item(topic, Stance.LESS_FAVORED, reasons, premises)
  }

  if (isHigh(input)) {
    reasons.push(
      note(
        'HIGH_REAL_RATE',
        `Juro real de ${real} a.a., a partir de ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)}: o IPCA+ fixa uma taxa real alta.`
      )
    )

    if (trend === SelicTrend.FALLING) {
      reasons.push(
        note(
          'SELIC_FALLING',
          'Com a Selic em queda, fixar a taxa real antes que ela caia reforça a leitura.'
        )
      )
    }

    return item(topic, Stance.FAVORED, reasons, premises)
  }

  reasons.push(
    note(
      'REAL_RATE_BETWEEN_THRESHOLDS',
      `Juro real de ${real} a.a. entre ${formatPercent(REAL_RATE_LOW_PERCENT, 0)} e ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)}: leitura neutra.`
    )
  )

  return item(topic, Stance.NEUTRAL, reasons, premises)
}

function fixedPre(input: MarketReadingsInput): MarketReadingItem {
  const { realRate, trend } = input
  const topic = ReadingTopic.FIXED_PRE
  const premises = [
    premise('LOW'),
    premise('TREND'),
    note(
      'PRE_MARK_TO_MARKET',
      'Prefixado resgatado antes do vencimento é marcado a mercado: se os juros sobem, o preço cai.'
    ),
  ]
  const reasons = [numbersReason(input)]

  if (trend === SelicTrend.RISING) {
    reasons.push(
      note(
        'SELIC_RISING',
        'Selic em alta: se os juros continuarem subindo, o prefixado já comprado perde valor se vendido antes do vencimento.'
      )
    )

    return item(topic, Stance.LESS_FAVORED, reasons, premises)
  }

  if (trend === null) {
    return item(
      topic,
      Stance.UNAVAILABLE,
      [
        ...reasons,
        missing(
          'Sem histórico da Selic para calcular a tendência: a leitura de prefixados depende dela.'
        ),
      ],
      premises
    )
  }

  if (trend === SelicTrend.FALLING) {
    if (realRate === null) {
      return item(
        topic,
        Stance.UNAVAILABLE,
        [...reasons, missing('Sem IPCA recente para conferir o juro real.')],
        premises
      )
    }

    if (realRate.greaterThanOrEqualTo(PRE_MIN_REAL_RATE_PERCENT)) {
      reasons.push(
        note(
          'SELIC_FALLING',
          `Selic em queda e juro real de ${formatPercent(realRate, 2)} a.a.: fixar a taxa prefixada antes da queda preserva a remuneração atual.`
        )
      )

      return item(topic, Stance.FAVORED, reasons, premises)
    }

    reasons.push(
      note(
        'LOW_REAL_RATE',
        `Selic em queda, mas o juro real de ${formatPercent(realRate, 2)} a.a. está abaixo de ${formatPercent(PRE_MIN_REAL_RATE_PERCENT, 0)}: fixar a taxa rende pouco acima da inflação, leitura neutra.`
      )
    )

    return item(topic, Stance.NEUTRAL, reasons, premises)
  }

  reasons.push(
    note(
      'SELIC_STABLE',
      'Selic estável: sem direção dos juros que favoreça ou prejudique a taxa prefixada.'
    )
  )

  return item(topic, Stance.NEUTRAL, reasons, premises)
}

function taxExempt(
  input: MarketReadingsInput,
  post: MarketReadingItem
): MarketReadingItem {
  const topic = ReadingTopic.TAX_EXEMPT
  const lastBracket = INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1]
  const premises: OverviewNote[] = [
    note(
      'INCOME_TAX_REGRESSIVE',
      `IR regressivo de ${formatPercent(INCOME_TAX_BRACKETS[0].rate, 1)} a ${formatPercent(lastBracket.rate, 1)} conforme o prazo; LCA e LCI são isentas para pessoa física.`
    ),
    ...post.premises,
  ]
  const reasons = [numbersReason(input)]

  switch (post.stance) {
    case Stance.FAVORED:
      reasons.push(
        note(
          'FOLLOWS_FIXED_POST',
          'Pós-fixado favorecido no cenário: a isenção de IR de LCA/LCI amplia a vantagem sobre o CDB tributado.'
        )
      )
      break
    case Stance.LESS_FAVORED:
      reasons.push(
        note(
          'FOLLOWS_FIXED_POST',
          'Pós-fixado menos favorecido no cenário: a isenção de IR ainda reduz a diferença para o CDB tributado (veja as equivalências).'
        )
      )
      break
    case Stance.UNAVAILABLE:
      reasons.push(
        missing('Sem Selic ou IPCA recentes: a leitura segue a do pós-fixado.')
      )
      break
    default:
      reasons.push(
        note(
          'FOLLOWS_FIXED_POST',
          'Pós-fixado neutro no cenário: a isenção de IR de LCA/LCI é o diferencial (veja as equivalências).'
        )
      )
  }

  return item(topic, post.stance, reasons, premises)
}

function variableIncome(
  topic: typeof ReadingTopic.STOCKS | typeof ReadingTopic.REAL_ESTATE_FUNDS,
  input: MarketReadingsInput
): MarketReadingItem {
  const { realRate, trend } = input
  const premises = [
    REAL_RATE_FORMULA_PREMISE,
    premise('HIGH'),
    premise('LOW'),
    premise('TREND'),
    note(
      'NO_EQUITY_MARKET_DATA',
      'Sem dados de preço de bolsa/FII nesta fase: a leitura vem só do cenário de juros.'
    ),
  ]
  const reasons = [numbersReason(input)]

  if (realRate === null && trend === null) {
    return item(
      topic,
      Stance.UNAVAILABLE,
      [...reasons, missing('Sem juro real nem tendência da Selic.')],
      premises
    )
  }

  const assessment = MarketScenario.assess(realRate, trend)
  const real = realRate ? formatPercent(realRate, 2) : null

  switch (assessment.bias) {
    case ScenarioBias.FAVOR_VARIABLE:
      reasons.push(
        assessment.cause === 'LOW_REAL_RATE'
          ? note(
              'LOW_REAL_RATE',
              `Juro real de ${real} a.a., abaixo de ${formatPercent(REAL_RATE_LOW_PERCENT, 0)}: a renda fixa paga pouco acima da inflação e a renda variável ganha espaço no cenário de juros.`
            )
          : note(
              'SELIC_FALLING',
              'Selic em queda: a renda fixa pós-fixada tende a render menos e a renda variável ganha espaço no cenário de juros.'
            )
      )

      return item(topic, Stance.FAVORED, reasons, premises)
    case ScenarioBias.FAVOR_FIXED:
      reasons.push(
        note(
          'HIGH_REAL_RATE',
          `Juro real de ${real} a.a., a partir de ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)}: a renda fixa paga bem e a renda variável perde atratividade relativa no cenário de juros.`
        )
      )

      return item(topic, Stance.LESS_FAVORED, reasons, premises)
    case ScenarioBias.FAVOR_LOCK_IN:
      reasons.push(
        note(
          'HIGH_REAL_RATE_FALLING_SELIC',
          `Juro real alto (${real} a.a.) e Selic em queda: sinais opostos para a renda variável, leitura neutra.`
        )
      )

      return item(topic, Stance.NEUTRAL, reasons, premises)
    default:
      reasons.push(
        note(
          'REAL_RATE_BETWEEN_THRESHOLDS',
          realRate
            ? `Juro real de ${real} a.a. entre ${formatPercent(REAL_RATE_LOW_PERCENT, 0)} e ${formatPercent(REAL_RATE_HIGH_PERCENT, 0)} e sem queda da Selic: o cenário de juros não favorece nem pesa contra.`
            : 'Sem juro real para conferir; a Selic não está em queda: leitura neutra.'
        )
      )

      return item(topic, Stance.NEUTRAL, reasons, premises)
  }
}

const signed = (value: Decimal) =>
  `${value.greaterThanOrEqualTo(0) ? '+' : ''}${formatPercent(value, 2)}`

function trendText(trend: IndexTrendDirection) {
  switch (trend) {
    case IndexTrendDirection.UP:
      return 'em tendência de alta'
    case IndexTrendDirection.DOWN:
      return 'em tendência de baixa'
    default:
      return 'sem tendência definida'
  }
}

/**
 * Acrescenta a tendência do índice à leitura de ações/FIIs como **contexto**:
 * entra em `reasons` e `premises`, e o `stance` fica exatamente como veio
 * dos juros (a tendência não é sinal de compra).
 */
function withIndexContext(
  reading: MarketReadingItem,
  context: IndexContext | undefined
): MarketReadingItem {
  if (!context) return reading

  const premises = reading.premises.filter(
    (premiseItem) => premiseItem.code !== 'NO_EQUITY_MARKET_DATA'
  )

  if (!context.reading) {
    return {
      ...reading,
      reasons: [
        ...reading.reasons,
        note(
          'INDEX_UNAVAILABLE',
          `Sem tendência do ${context.name}: ${context.unavailableDetail ?? 'fonte indisponível'}.`
        ),
      ],
      premises: [
        ...premises,
        note(
          'NO_EQUITY_MARKET_DATA',
          `Sem dado de preço do ${context.name} nesta leitura: ela vem só do cenário de juros.`
        ),
      ],
    }
  }

  const index = context.reading
  const code = `INDEX_TREND_${index.trend}`

  return {
    ...reading,
    reasons: [
      ...reading.reasons,
      note(
        code,
        `${context.name} ${trendText(index.trend)}: ${signed(new Decimal(index.vsMovingAverage200))} sobre a média de ${INDEX_MOVING_AVERAGE_DAYS} dias e ${signed(new Decimal(index.return12m))} em ${INDEX_RETURN_MONTHS} meses (até ${index.asOf}). É contexto: não altera a leitura dos juros.`
      ),
    ],
    premises: [
      ...premises,
      note(
        'INDEX_TREND_RULE',
        `Tendência do índice: alta se o preço está acima da média de ${INDEX_MOVING_AVERAGE_DAYS} dias e o retorno em ${INDEX_RETURN_MONTHS} meses é positivo; baixa se está abaixo e o retorno é negativo; senão, mista. Descreve o passado, não prevê.`
      ),
      note(
        'INDEX_CONTEXT_ONLY',
        'A tendência do índice é contexto: não muda a leitura vinda dos juros.'
      ),
    ],
  }
}
