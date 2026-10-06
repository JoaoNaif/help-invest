import { Provider } from '@nestjs/common'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { CreatePositionUseCase } from '@/domain/portfolio/applications/use-cases/create-position'
import { DeletePositionUseCase } from '@/domain/portfolio/applications/use-cases/delete-position'
import { EditPositionUseCase } from '@/domain/portfolio/applications/use-cases/edit-position'
import { GetInvestorProfileUseCase } from '@/domain/portfolio/applications/use-cases/get-investor-profile'
import { GetPortfolioSummaryUseCase } from '@/domain/portfolio/applications/use-cases/get-portfolio-summary'
import { ListPositionsUseCase } from '@/domain/portfolio/applications/use-cases/list-positions'
import { SaveInvestorProfileUseCase } from '@/domain/portfolio/applications/use-cases/save-investor-profile'

export const portfolioUseCases: Provider[] = [
  {
    provide: SaveInvestorProfileUseCase,
    inject: [InvestorProfilesRepository],
    useFactory: (profiles: InvestorProfilesRepository) =>
      new SaveInvestorProfileUseCase(profiles),
  },
  {
    provide: GetInvestorProfileUseCase,
    inject: [InvestorProfilesRepository],
    useFactory: (profiles: InvestorProfilesRepository) =>
      new GetInvestorProfileUseCase(profiles),
  },
  {
    provide: CreatePositionUseCase,
    inject: [PositionsRepository],
    useFactory: (positions: PositionsRepository) =>
      new CreatePositionUseCase(positions),
  },
  {
    provide: EditPositionUseCase,
    inject: [PositionsRepository],
    useFactory: (positions: PositionsRepository) =>
      new EditPositionUseCase(positions),
  },
  {
    provide: DeletePositionUseCase,
    inject: [PositionsRepository],
    useFactory: (positions: PositionsRepository) =>
      new DeletePositionUseCase(positions),
  },
  {
    provide: ListPositionsUseCase,
    inject: [PositionsRepository],
    useFactory: (positions: PositionsRepository) =>
      new ListPositionsUseCase(positions),
  },
  {
    provide: GetPortfolioSummaryUseCase,
    inject: [PositionsRepository, InvestorProfilesRepository],
    useFactory: (
      positions: PositionsRepository,
      profiles: InvestorProfilesRepository
    ) => new GetPortfolioSummaryUseCase(positions, profiles),
  },
]
