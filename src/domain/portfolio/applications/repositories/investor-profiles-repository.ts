import { InvestorProfile } from '../../entities/investor-profile'

export abstract class InvestorProfilesRepository {
  abstract findByUserId(userId: string): Promise<InvestorProfile | null>
  abstract create(profile: InvestorProfile): Promise<void>
  abstract save(profile: InvestorProfile): Promise<void>
}
