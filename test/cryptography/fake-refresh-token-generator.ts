import { RefreshTokenGenerator } from '@/domain/accounts/applications/cryptography/refresh-token-generator'

export class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  private count = 0

  generate(): string {
    this.count++

    return `refresh-token-${this.count}`
  }

  hash(token: string): string {
    return token.concat('-hashed')
  }
}
