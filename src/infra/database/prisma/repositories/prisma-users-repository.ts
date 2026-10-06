import { Injectable } from '@nestjs/common'
import { UsersRepository } from '@/domain/accounts/applications/repositories/users-repository'
import { User } from '@/domain/accounts/entities/user'
import { PrismaUserMapper } from '../mappers/prisma-user-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } })

    return user ? PrismaUserMapper.toDomain(user) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } })

    return user ? PrismaUserMapper.toDomain(user) : null
  }

  async create(user: User): Promise<void> {
    await this.prisma.user.create({ data: PrismaUserMapper.toPrisma(user) })
  }
}
