import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Bot, Composer, Context } from "grammy"

@Injectable()
export class TelegramService
    implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(TelegramService.name)
    private bot: Bot | null = null
    private readonly rootComposer = new Composer<Context>()

    constructor(private readonly configService: ConfigService) {}

    registerUpdate(composer: Composer<Context>): void {
        this.rootComposer.use(composer)
    }

    onModuleInit(): void {
        const token = this.configService.get<string>("app.telegramBotToken")

        if (!token) {
            this.logger.warn(
                "TELEGRAM_BOT_TOKEN is not set — Telegram disabled",
            )
            return
        }

        this.bot = new Bot(token)
        this.bot.use(this.rootComposer)
    }

    onApplicationBootstrap(): void {
        if (!this.bot) {
            return
        }

        void this.bot.start({
            onStart: (botInfo) => {
                this.logger.log(`Started as @${botInfo.username}`)
            },
        })
    }

    async onModuleDestroy(): Promise<void> {
        if (this.bot) {
            await this.bot.stop()
        }
    }
}
