import { faker } from '@faker-js/faker'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog, LlmLogProps } from '@/domain/recommendations/entities/llm-log'

export function makeLlmLog(
  override: Partial<LlmLogProps> = {},
  id?: UniqueEntityId
) {
  return LlmLog.create(
    {
      userId: new UniqueEntityId(),
      purpose: LlmPurpose.EXTRACTION,
      model: 'claude-sonnet-5-5',
      prompt: faker.lorem.paragraph(),
      response: { options: [] },
      inputTokens: faker.number.int({ min: 100, max: 5000 }),
      outputTokens: faker.number.int({ min: 50, max: 2000 }),
      ...override,
    },
    id
  )
}
