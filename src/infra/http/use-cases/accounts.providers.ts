import { Provider } from '@nestjs/common'
import { Encrypter } from '@/domain/accounts/applications/cryptography/encrypter'
import { HashCompare } from '@/domain/accounts/applications/cryptography/hash-compare'
import { HashGenerator } from '@/domain/accounts/applications/cryptography/hash-generator'
import { RefreshTokenGenerator } from '@/domain/accounts/applications/cryptography/refresh-token-generator'
import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { UsersRepository } from '@/domain/accounts/applications/repositories/users-repository'
import { AuthenticateUseCase } from '@/domain/accounts/applications/use-cases/authenticate'
import { GetCurrentUserUseCase } from '@/domain/accounts/applications/use-cases/get-current-user'
import { LogoutUseCase } from '@/domain/accounts/applications/use-cases/logout'
import { RefreshSessionUseCase } from '@/domain/accounts/applications/use-cases/refresh-session'
import { RegisterUserUseCase } from '@/domain/accounts/applications/use-cases/register-user'

// O domain não tem decorators, então cada use-case é montado por factory com
// os ports resolvidos pelo Nest. A própria classe do use-case é o token de DI.
export const accountsUseCases: Provider[] = [
  {
    provide: RegisterUserUseCase,
    inject: [UsersRepository, HashGenerator],
    useFactory: (users: UsersRepository, hasher: HashGenerator) =>
      new RegisterUserUseCase(users, hasher),
  },
  {
    provide: AuthenticateUseCase,
    inject: [
      UsersRepository,
      SessionsRepository,
      HashCompare,
      Encrypter,
      RefreshTokenGenerator,
    ],
    useFactory: (
      users: UsersRepository,
      sessions: SessionsRepository,
      hashCompare: HashCompare,
      encrypter: Encrypter,
      refreshTokenGenerator: RefreshTokenGenerator
    ) =>
      new AuthenticateUseCase(
        users,
        sessions,
        hashCompare,
        encrypter,
        refreshTokenGenerator
      ),
  },
  {
    provide: RefreshSessionUseCase,
    inject: [SessionsRepository, Encrypter, RefreshTokenGenerator],
    useFactory: (
      sessions: SessionsRepository,
      encrypter: Encrypter,
      refreshTokenGenerator: RefreshTokenGenerator
    ) => new RefreshSessionUseCase(sessions, encrypter, refreshTokenGenerator),
  },
  {
    provide: LogoutUseCase,
    inject: [SessionsRepository, RefreshTokenGenerator],
    useFactory: (
      sessions: SessionsRepository,
      refreshTokenGenerator: RefreshTokenGenerator
    ) => new LogoutUseCase(sessions, refreshTokenGenerator),
  },
  {
    provide: GetCurrentUserUseCase,
    inject: [UsersRepository],
    useFactory: (users: UsersRepository) => new GetCurrentUserUseCase(users),
  },
]
