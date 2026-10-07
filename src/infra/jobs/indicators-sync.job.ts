import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SyncIndicatorsUseCase } from '@/domain/market-data/applications/use-cases/sync-indicators'
import { EnvService } from '../env/env.service'

/**
 * UC-13 agendado: mantém Selic, CDI e IPCA em dia no banco.
 *
 * Roda ao subir o app e a cada 6 horas. Por que assim (ver docs/05):
 * - ao subir: uso pessoal, o app nem sempre fica ligado; quem liga depois de
 *   dias recebe o que faltou antes da primeira comparação;
 * - a cada 6 h: o UC-13 é idempotente e barato, e a repetição já é o "retry"
 *   quando o BCB está fora — sem lógica extra de tentativas.
 * Nunca lança: falha da fonte vira log e o próximo ciclo tenta de novo.
 */
@Injectable()
export class IndicatorsSyncJob implements OnApplicationBootstrap {
  private logger = new Logger(IndicatorsSyncJob.name)
  private running = false

  constructor(
    private syncIndicators: SyncIndicatorsUseCase,
    private env: EnvService
  ) {}

  onApplicationBootstrap() {
    // Sem await: a sincronização não pode atrasar a subida da API.
    void this.run()
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    await this.run()
  }

  async run() {
    if (!this.env.get('INDICATORS_SYNC_ENABLED') || this.running) {
      return
    }

    this.running = true

    try {
      const { synced, failed } = (await this.syncIndicators.execute()).value

      for (const { indicator, inserted } of synced) {
        if (inserted > 0) {
          this.logger.log(`${indicator}: ${inserted} novo(s) valor(es)`)
        }
      }

      for (const { indicator, error } of failed) {
        this.logger.warn(`${indicator}: falhou (${error.message})`)
      }
    } catch (error) {
      // Ex.: banco fora do ar. O job nunca derruba o processo.
      this.logger.error('Falha ao sincronizar indicadores', error)
    } finally {
      this.running = false
    }
  }
}
