import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { Session } from '@/domain/accounts/entities/session'

export class InMemorySessionsRepository implements SessionsRepository {
  public items: Session[] = []

  async create(session: Session) {
    this.items.push(session)
  }
}
