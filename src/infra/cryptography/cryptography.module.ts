import { Module } from '@nestjs/common'
import { JwtEncrypter } from './jwt.encrypter'
import { Encrypter } from '@/domain/accounts/applications/cryptography/encrypter'
import { HashCompare } from '@/domain/accounts/applications/cryptography/hash-compare'
import { HashGenerator } from '@/domain/accounts/applications/cryptography/hash-generator'
import { RefreshTokenGenerator } from '@/domain/accounts/applications/cryptography/refresh-token-generator'
import { BcryptHasher } from './bcrypt-hasher'
import { Sha256RefreshTokenGenerator } from './sha256-refresh-token-generator'

@Module({
  providers: [
    { provide: Encrypter, useClass: JwtEncrypter },
    { provide: HashCompare, useClass: BcryptHasher },
    { provide: HashGenerator, useClass: BcryptHasher },
    { provide: RefreshTokenGenerator, useClass: Sha256RefreshTokenGenerator },
  ],
  exports: [Encrypter, HashCompare, HashGenerator, RefreshTokenGenerator],
})
export class CryptographyModule {}
