/**
 * Gera o refresh token e o hash usado para buscá-lo no banco.
 * O hash precisa ser determinístico (SHA-256, não bcrypt) — ver
 * docs/08-casos-de-uso.md#ports-necessários.
 */
export abstract class RefreshTokenGenerator {
  abstract generate(): string
  abstract hash(token: string): string
}
