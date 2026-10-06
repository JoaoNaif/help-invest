import { faker } from '@faker-js/faker'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { User, UserProps } from '@/domain/accounts/entities/user'

export function makeUser(
  override: Partial<UserProps> = {},
  id?: UniqueEntityId
) {
  return User.create(
    {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      passwordHash: faker.internet.password(),
      ...override,
    },
    id
  )
}
