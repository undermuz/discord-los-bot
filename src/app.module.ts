import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import configuration from "./config/configuration.js"
import { DatabaseModule } from "./database/database.module.js"
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js"
import { RollingModule } from "./modules/rolling/rolling.module.js"
import { DiscordModule } from "./platforms/discord/discord.module.js"
import { TelegramModule } from "./platforms/telegram/telegram.module.js"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        DatabaseModule,
        DiscordModule,
        TelegramModule,
        OnboardingModule,
        RollingModule,
    ],
})
export class AppModule {}
