import { Module, OnModuleInit } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { EmojiToRole } from "../../database/entities/emoji-to-role.entity.js"
import { TelegramService } from "../../platforms/telegram/telegram.service.js"
import { OnboardingDiscordCommands } from "./discord/onboarding.discord.commands.js"
import { OnboardingDiscordGateway } from "./discord/onboarding.discord.gateway.js"
import { OnboardingService } from "./onboarding.service.js"
import { createOnboardingComposer } from "./tg/onboarding.tg.update.js"

@Module({
    imports: [TypeOrmModule.forFeature([EmojiToRole])],
    providers: [
        OnboardingService,
        OnboardingDiscordGateway,
        OnboardingDiscordCommands,
    ],
})
export class OnboardingModule implements OnModuleInit {
    constructor(private readonly telegramService: TelegramService) {}

    onModuleInit(): void {
        this.telegramService.registerUpdate(createOnboardingComposer())
    }
}
