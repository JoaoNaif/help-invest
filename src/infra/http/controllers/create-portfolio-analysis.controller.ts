import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { z } from 'zod'
import { PortfolioStrategy } from '@/domain/portfolio-analysis/entities/enums/portfolio-strategy'
import { CreatePortfolioAnalysisUseCase } from '@/domain/portfolio-analysis/applications/use-cases/create-portfolio-analysis'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { PortfolioAnalysisPresenter } from '../presenters/portfolio-analysis-presenter'

const createPortfolioAnalysisBodySchema = z.object({
  strategy: z.nativeEnum(PortfolioStrategy),
})

type CreatePortfolioAnalysisBodySchema = z.infer<
  typeof createPortfolioAnalysisBodySchema
>

/** POST /portfolio-analyses — carteira × perfil × estratégia × mercado (sem LLM) */
@Controller('portfolio-analyses')
export class CreatePortfolioAnalysisController {
  constructor(
    private createPortfolioAnalysis: CreatePortfolioAnalysisUseCase
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async handle(
    @CurrentUser() user: UserPayload,
    @Body(new ZodValidationPipe(createPortfolioAnalysisBodySchema))
    body: CreatePortfolioAnalysisBodySchema
  ) {
    const result = await this.createPortfolioAnalysis.execute({
      userId: user.sub,
      strategy: body.strategy,
    })

    return {
      analysis: PortfolioAnalysisPresenter.toHTTP(
        result.value.analysis,
        // Recém-criada: ainda não há explicação.
        null
      ),
    }
  }
}
