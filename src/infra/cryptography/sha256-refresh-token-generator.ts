import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { RefreshTokenGenerator } from '@/domain/accounts/applications/cryptography/refresh-token-generator'

// 32 bytes aleatórios já tornam força bruta inviável; por isso o hash pode ser
// SHA-256 (determinístico, permite buscar a sessão) em vez de bcrypt.
const TOKEN_BYTES = 32

@Injectable()
export class Sha256RefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url')
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
