import { faker } from '@faker-js/faker'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Session, SessionProps } from '@/domain/accounts/entities/session'

export function makeSession(
  override: Partial<SessionProps> = {},
  id?: UniqueEntityId
) {
  return Session.create(
    {
      userId: new UniqueEntityId(),
      tokenHash: faker.string.alphanumeric(64),
      expiresAt: faker.date.soon({ days: 30 }),
      ...override,
    },
    id
  )
}
