import { Module, OnModuleInit } from "@nestjs/common"
import { TelegramService } from "../../platforms/telegram/telegram.service.js"
import { RollingDiscordCommands } from "./discord/rolling.discord.commands.js"
import { RollingDiscordPresenter } from "./discord/rolling.discord.presenter.js"
import { RollingStatisticsService } from "./rolling-statistics.service.js"
import { RollingService } from "./rolling.service.js"
import { createRollingComposer } from "./tg/rolling.tg.update.js"

@Module({
    providers: [
        RollingService,
        RollingStatisticsService,
        RollingDiscordPresenter,
        RollingDiscordCommands,
    ],
})
export class RollingModule implements OnModuleInit {
    constructor(private readonly telegramService: TelegramService) {}

    onModuleInit(): void {
        this.telegramService.registerUpdate(createRollingComposer())
    }
}
