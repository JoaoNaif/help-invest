import { Prisma, Session as PrismaSession } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Session } from '@/domain/accounts/entities/session'

export class PrismaSessionMapper {
  static toDomain(raw: PrismaSession): Session {
    return Session.create(
      {
        userId: new UniqueEntityId(raw.userId),
        tokenHash: raw.tokenHash,
        expiresAt: raw.expiresAt,
        revokedAt: raw.revokedAt,
        userAgent: raw.userAgent,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(session: Session): Prisma.SessionUncheckedCreateInput {
    return {
      id: session.id.toString(),
      userId: session.userId.toString(),
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
    }
  }
}
