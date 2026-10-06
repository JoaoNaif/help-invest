import { Injectable } from '@nestjs/common'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'
import { PrismaLlmLogMapper } from '../mappers/prisma-llm-log-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaLlmLogsRepository implements LlmLogsRepository {
  constructor(private prisma: PrismaService) {}

  async findManyByComparisonId(
    comparisonId: string,
    purpose: LlmPurpose
  ): Promise<LlmLog[]> {
    const logs = await this.prisma.llmLog.findMany({
      where: { comparisonId, purpose },
      orderBy: { createdAt: 'desc' },
    })

    return logs.map(PrismaLlmLogMapper.toDomain)
  }

  async create(log: LlmLog): Promise<void> {
    await this.prisma.llmLog.create({ data: PrismaLlmLogMapper.toPrisma(log) })
  }
}
