import { Injectable } from '@nestjs/common'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'
import { PrismaInvestorProfileMapper } from '../mappers/prisma-investor-profile-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaInvestorProfilesRepository
  implements InvestorProfilesRepository
{
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<InvestorProfile | null> {
    const profile = await this.prisma.investorProfile.findUnique({
      where: { userId },
    })

    return profile ? PrismaInvestorProfileMapper.toDomain(profile) : null
  }

  async create(profile: InvestorProfile): Promise<void> {
    await this.prisma.investorProfile.create({
      data: PrismaInvestorProfileMapper.toPrisma(profile),
    })
  }

  async save(profile: InvestorProfile): Promise<void> {
    const data = PrismaInvestorProfileMapper.toPrisma(profile)

    await this.prisma.investorProfile.update({ where: { id: data.id }, data })
  }
}
