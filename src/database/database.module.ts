import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { EmojiToRole } from "./entities/emoji-to-role.entity.js"
import { CreateEmojiToRoles1738281600000 } from "./migrations/1738281600000-CreateEmojiToRoles.js"

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: "better-sqlite3" as const,
                database: configService.get<string>(
                    "app.dbPath",
                    "./data/bot.sqlite",
                ),
                entities: [EmojiToRole],
                migrations: [CreateEmojiToRoles1738281600000],
                migrationsRun: true,
                synchronize: false,
            }),
        }),
        TypeOrmModule.forFeature([EmojiToRole]),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {}
