import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import { PlayerRating } from "../../database/entities/player-rating.entity.js"
import { LeaderboardService } from "./leaderboard.service.js"
import { MatchFormat } from "./types.js"

@Injectable()
export class LeaderboardInactivityService {
    private readonly logger = new Logger(LeaderboardInactivityService.name)

    constructor(
        @InjectRepository(LeaderboardGuildConfig)
        private readonly configRepository: Repository<LeaderboardGuildConfig>,
        @InjectRepository(PlayerRating)
        private readonly playerRatingRepository: Repository<PlayerRating>,
        private readonly leaderboardService: LeaderboardService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleInactivityCheck(): Promise<void> {
        this.logger.log("Running leaderboard inactivity check")

        const configs = await this.configRepository.find()

        for (const config of configs) {
            await this.checkGuildInactivity(config)
        }
    }

    async checkGuildInactivity(config: LeaderboardGuildConfig): Promise<void> {
        const favoriteFormats = config.favoriteFormats as MatchFormat[]

        if (favoriteFormats.length === 0) {
            return
        }

        const players = await this.playerRatingRepository
            .createQueryBuilder("rating")
            .select("rating.discordUserId", "discordUserId")
            .where("rating.guildId = :guildId", { guildId: config.guildId })
            .groupBy("rating.discordUserId")
            .getRawMany<{ discordUserId: string }>()

        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - config.inactivityDays)

        for (const player of players) {
            const favoriteRatings = await this.playerRatingRepository.find({
                where: favoriteFormats.map((format) => ({
                    guildId: config.guildId,
                    discordUserId: player.discordUserId,
                    format,
                })),
            })

            if (favoriteRatings.length === 0) {
                continue
            }

            const lastPlayedAt = favoriteRatings
                .map((rating) => rating.lastPlayedAt)
                .filter((date): date is Date => date instanceof Date)
                .sort((a, b) => b.getTime() - a.getTime())[0]

            if (!lastPlayedAt || lastPlayedAt < cutoff) {
                await this.leaderboardService.freezeInactivePlayer(
                    config.guildId,
                    player.discordUserId,
                )
            }
        }
    }
}
