import { Module } from '@nestjs/common'
import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { UsersRepository } from '@/domain/accounts/applications/repositories/users-repository'
import { PrismaService } from './prisma/prisma.service'
import { PrismaSessionsRepository } from './prisma/repositories/prisma-sessions-repository'
import { PrismaUsersRepository } from './prisma/repositories/prisma-users-repository'

// Cada repositório (port do domain → adapter Prisma) entra aqui em `providers`
// e `exports`, no formato { provide: XRepository, useClass: PrismaXRepository }.
@Module({
  providers: [
    PrismaService,
    { provide: UsersRepository, useClass: PrismaUsersRepository },
    { provide: SessionsRepository, useClass: PrismaSessionsRepository },
  ],
  exports: [PrismaService, UsersRepository, SessionsRepository],
})
export class DatabaseModule {}
