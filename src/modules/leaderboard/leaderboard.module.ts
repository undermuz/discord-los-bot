import { Module, OnModuleInit } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import {
    PlayerRating,
    PlayerState,
} from "../../database/entities/player-rating.entity.js"
import {
    MatchConfirmation,
    RatingMatch,
    RatingMatchRound,
} from "../../database/entities/rating-match.entity.js"
import { RatingTierRole } from "../../database/entities/rating-tier-role.entity.js"
import { TelegramService } from "../../platforms/telegram/telegram.service.js"
import { LeaderboardDiscordCommands } from "./discord/leaderboard.discord.commands.js"
import { LeaderboardDiscordGateway } from "./discord/leaderboard.discord.gateway.js"
import { LeaderboardDiscordPresenter } from "./discord/leaderboard.discord.presenter.js"
import { LeaderboardDiscordRoles } from "./discord/leaderboard.discord.roles.js"
import { LeaderboardAggregateService } from "./leaderboard-aggregate.service.js"
import { LeaderboardConfigService } from "./leaderboard-config.service.js"
import { LeaderboardInactivityService } from "./leaderboard-inactivity.service.js"
import { LeaderboardRatingService } from "./leaderboard-rating.service.js"
import { LeaderboardRoleService } from "./leaderboard-role.service.js"
import { LeaderboardSeriesService } from "./leaderboard-series.service.js"
import { LeaderboardService } from "./leaderboard.service.js"
import { createLeaderboardComposer } from "./tg/leaderboard.tg.update.js"

@Module({
    imports: [
        TypeOrmModule.forFeature([
            LeaderboardGuildConfig,
            RatingTierRole,
            PlayerRating,
            PlayerState,
            RatingMatch,
            MatchConfirmation,
            RatingMatchRound,
        ]),
    ],
    providers: [
        LeaderboardConfigService,
        LeaderboardRatingService,
        LeaderboardAggregateService,
        LeaderboardRoleService,
        LeaderboardSeriesService,
        LeaderboardService,
        LeaderboardInactivityService,
        LeaderboardDiscordCommands,
        LeaderboardDiscordGateway,
        LeaderboardDiscordPresenter,
        LeaderboardDiscordRoles,
    ],
})
export class LeaderboardModule implements OnModuleInit {
    constructor(private readonly telegramService: TelegramService) {}

    onModuleInit(): void {
        this.telegramService.registerUpdate(createLeaderboardComposer())
    }
}
