import { Session } from '../../entities/session'

export abstract class SessionsRepository {
  abstract create(session: Session): Promise<void>
}
