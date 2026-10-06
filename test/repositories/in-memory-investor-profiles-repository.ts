import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'

export class InMemoryInvestorProfilesRepository implements InvestorProfilesRepository {
  public items: InvestorProfile[] = []

  async findByUserId(userId: string) {
    return this.items.find((item) => item.userId.toString() === userId) ?? null
  }

  async create(profile: InvestorProfile) {
    this.items.push(profile)
  }

  async save(profile: InvestorProfile) {
    const index = this.items.findIndex((item) => item.id.equals(profile.id))

    this.items[index] = profile
  }
}
