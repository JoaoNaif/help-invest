import { ComparisonExplanation } from '@/domain/comparison/applications/dtos/comparison-explanation'

export function makeExplanation(
  override: Partial<ComparisonExplanation> = {}
): ComparisonExplanation {
  return {
    summary: 'A opção 1 rende mais líquido.',
    bestOptionId: null,
    bestReason: null,
    options: [],
    ...override,
  }
}
