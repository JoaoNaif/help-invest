import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'

export interface SessionProps {
  userId: UniqueEntityId
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  userAgent: string | null
  createdAt: Date
}

/** Validade do refresh token (sessão longa). */
export const SESSION_DURATION_DAYS = 30

/**
 * Refresh token com rotação. Cada token serve uma vez: ao renovar, a sessão
 * antiga é revogada. Ver docs/07-modelo-de-dados.md#2-session.
 */
export class Session extends Entity<SessionProps> {
  get userId() {
    return this.props.userId
  }

  get tokenHash() {
    return this.props.tokenHash
  }

  get expiresAt() {
    return this.props.expiresAt
  }

  get revokedAt() {
    return this.props.revokedAt
  }

  get userAgent() {
    return this.props.userAgent
  }

  get createdAt() {
    return this.props.createdAt
  }

  get isRevoked() {
    return this.props.revokedAt !== null
  }

  isExpired(now = new Date()) {
    return this.props.expiresAt.getTime() <= now.getTime()
  }

  isValid(now = new Date()) {
    return !this.isRevoked && !this.isExpired(now)
  }

  revoke(now = new Date()) {
    if (this.isRevoked) return

    this.props.revokedAt = now
  }

  static expiresAtFrom(now = new Date()) {
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

    return expiresAt
  }

  static create(
    props: Optional<SessionProps, 'revokedAt' | 'userAgent' | 'createdAt'>,
    id?: UniqueEntityId
  ) {
    return new Session(
      {
        ...props,
        revokedAt: props.revokedAt ?? null,
        userAgent: props.userAgent ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    )
  }
}
