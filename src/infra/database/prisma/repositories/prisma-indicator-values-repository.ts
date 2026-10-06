import { Injectable } from '@nestjs/common'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'
import { PrismaIndicatorValueMapper } from '../mappers/prisma-indicator-value-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaIndicatorValuesRepository
  implements IndicatorValuesRepository
{
  constructor(private prisma: PrismaService) {}

  async findLatest(indicator: Indicator): Promise<IndicatorValue | null> {
    const value = await this.prisma.indicatorValue.findFirst({
      where: { indicator },
      orderBy: { date: 'desc' },
    })

    return value ? PrismaIndicatorValueMapper.toDomain(value) : null
  }

  async findRecent(
    indicator: Indicator,
    limit: number
  ): Promise<IndicatorValue[]> {
    const values = await this.prisma.indicatorValue.findMany({
      where: { indicator },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return values.map(PrismaIndicatorValueMapper.toDomain)
  }

  async createMany(values: IndicatorValue[]): Promise<number> {
    const { count } = await this.prisma.indicatorValue.createMany({
      data: values.map(PrismaIndicatorValueMapper.toPrisma),
      skipDuplicates: true,
    })

    return count
  }
}
