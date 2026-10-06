import { Controller, Get } from '@nestjs/common'
import { ListPositionsUseCase } from '@/domain/portfolio/applications/use-cases/list-positions'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { PositionPresenter } from '../presenters/position-presenter'

/** UC-11 — GET /positions */
@Controller('positions')
export class ListPositionsController {
  constructor(private listPositions: ListPositionsUseCase) {}

  @Get()
  async handle(@CurrentUser() user: UserPayload) {
    const result = await this.listPositions.execute({ userId: user.sub })

    return { positions: result.value.positions.map(PositionPresenter.toHTTP) }
  }
}
