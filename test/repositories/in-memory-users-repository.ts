import { UsersRepository } from '@/domain/accounts/applications/repositories/users-repository'
import { User } from '@/domain/accounts/entities/user'

export class InMemoryUsersRepository implements UsersRepository {
  public items: User[] = []

  async findByEmail(email: string) {
    return this.items.find((item) => item.email === email) ?? null
  }

  async create(user: User) {
    this.items.push(user)
  }
}
