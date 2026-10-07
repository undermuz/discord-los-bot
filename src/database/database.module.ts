import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { EmojiToRole } from "./entities/emoji-to-role.entity.js"
import { LeaderboardGuildConfig } from "./entities/leaderboard-guild-config.entity.js"
import { PlayerRating, PlayerState } from "./entities/player-rating.entity.js"
import {
    MatchConfirmation,
    RatingMatch,
    RatingMatchPlayerChange,
    RatingMatchRound,
} from "./entities/rating-match.entity.js"
import { RatingTierRole } from "./entities/rating-tier-role.entity.js"
import { CreateEmojiToRoles1738281600000 } from "./migrations/1738281600000-CreateEmojiToRoles.js"
import { CreateLeaderboard1738290000000 } from "./migrations/1738290000000-CreateLeaderboard.js"
import { AddRatingMatchRounds1738291000000 } from "./migrations/1738291000000-AddRatingMatchRounds.js"
import { AddRoundHeroesAndFirstPlayer1738291200000 } from "./migrations/1738291200000-AddRoundHeroesAndFirstPlayer.js"
import { ChangeRatingPrecision1738291300000 } from "./migrations/1738291300000-ChangeRatingPrecision.js"
import { AddCalibrationCompleted1738291400000 } from "./migrations/1738291400000-AddCalibrationCompleted.js"
import { ReplaceRatingTiers1738291500000 } from "./migrations/1738291500000-ReplaceRatingTiers.js"
import { OpenTopRatingTier1738291600000 } from "./migrations/1738291600000-OpenTopRatingTier.js"
import { UpdateCalibrationAndFreeze1738291700000 } from "./migrations/1738291700000-UpdateCalibrationAndFreeze.js"
import { ImportEmojiToRolesFromDb21738291800000 } from "./migrations/1738291800000-ImportEmojiToRolesFromDb2.js"
import { SplitFormatAndSeries1738291900000 } from "./migrations/1738291900000-SplitFormatAndSeries.js"
import { AddMatchCancellation1738292000000 } from "./migrations/1738292000000-AddMatchCancellation.js"

const leaderboardEntities = [
    LeaderboardGuildConfig,
    RatingTierRole,
    PlayerRating,
    PlayerState,
    RatingMatch,
    MatchConfirmation,
    RatingMatchRound,
    RatingMatchPlayerChange,
]

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
                entities: [EmojiToRole, ...leaderboardEntities],
                migrations: [
                    CreateEmojiToRoles1738281600000,
                    CreateLeaderboard1738290000000,
                    AddRatingMatchRounds1738291000000,
                    AddRoundHeroesAndFirstPlayer1738291200000,
                    ChangeRatingPrecision1738291300000,
                    AddCalibrationCompleted1738291400000,
                    ReplaceRatingTiers1738291500000,
                    OpenTopRatingTier1738291600000,
                    UpdateCalibrationAndFreeze1738291700000,
                    ImportEmojiToRolesFromDb21738291800000,
                    SplitFormatAndSeries1738291900000,
                    AddMatchCancellation1738292000000,
                ],
                migrationsRun: true,
                synchronize: false,
            }),
        }),
        TypeOrmModule.forFeature([EmojiToRole, ...leaderboardEntities]),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {}
