import { Injectable } from '@nestjs/common'
import {
  ComparisonsRepository,
  PaginationParams,
} from '@/domain/comparison/applications/repositories/comparisons-repository'
import { Comparison } from '@/domain/comparison/entities/comparison'
import { ComparisonOption } from '@/domain/comparison/entities/comparison-option'
import { PrismaComparisonMapper } from '../mappers/prisma-comparison-mapper'
import { PrismaComparisonOptionMapper } from '../mappers/prisma-comparison-option-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaComparisonsRepository implements ComparisonsRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Comparison | null> {
    const comparison = await this.prisma.comparison.findUnique({
      where: { id },
    })

    return comparison ? PrismaComparisonMapper.toDomain(comparison) : null
  }

  async findManyByUserId(
    userId: string,
    { page, perPage }: PaginationParams
  ): Promise<Comparison[]> {
    const comparisons = await this.prisma.comparison.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: perPage,
      skip: (page - 1) * perPage,
    })

    return comparisons.map(PrismaComparisonMapper.toDomain)
  }

  async findOptionsByComparisonId(
    comparisonId: string
  ): Promise<ComparisonOption[]> {
    const options = await this.prisma.comparisonOption.findMany({
      where: { comparisonId },
      orderBy: { createdAt: 'asc' },
    })

    return options.map(PrismaComparisonOptionMapper.toDomain)
  }

  async create(
    comparison: Comparison,
    options: ComparisonOption[]
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.comparison.create({
        data: PrismaComparisonMapper.toPrisma(comparison),
      }),
      this.prisma.comparisonOption.createMany({
        data: options.map(PrismaComparisonOptionMapper.toPrisma),
      }),
    ])
  }

  async save(
    comparison: Comparison,
    options: ComparisonOption[]
  ): Promise<void> {
    const comparisonData = PrismaComparisonMapper.toPrisma(comparison)
    const optionIds = options.map((option) => option.id.toString())

    // A comparação é gravada por último: `chosenOptionId` aponta para uma
    // opção que precisa existir antes.
    await this.prisma.$transaction([
      this.prisma.comparisonOption.deleteMany({
        where: { comparisonId: comparisonData.id, id: { notIn: optionIds } },
      }),
      ...options.map((option) => {
        const data = PrismaComparisonOptionMapper.toPrisma(option)

        return this.prisma.comparisonOption.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        })
      }),
      this.prisma.comparison.update({
        where: { id: comparisonData.id },
        data: comparisonData,
      }),
    ])
  }
}
