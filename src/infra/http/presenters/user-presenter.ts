import { User } from '@/domain/accounts/entities/user'

// Nunca expõe o passwordHash.
export class UserPresenter {
  static toHTTP(user: User) {
    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
