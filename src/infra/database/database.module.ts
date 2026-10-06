import { Module } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service'

// Cada repositório (port do domain → adapter Prisma) entra aqui em `providers`
// e `exports`, no formato { provide: XRepository, useClass: PrismaXRepository }.
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
