import { Controller, Get } from '@nestjs/common'
import { ListRecentComparisonOptionsUseCase } from '@/domain/comparison/applications/use-cases/list-recent-comparison-options'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ComparisonPresenter } from '../presenters/comparison-presenter'

/** GET /comparison-options/recent — opções já usadas, para não redigitar */
@Controller('comparison-options/recent')
export class ListRecentComparisonOptionsController {
  constructor(private listRecentOptions: ListRecentComparisonOptionsUseCase) {}

  @Get()
  async handle(@CurrentUser() user: UserPayload) {
    const result = await this.listRecentOptions.execute({ userId: user.sub })

    return {
      options: result.value.options.map(ComparisonPresenter.recentOptionToHTTP),
    }
  }
}
