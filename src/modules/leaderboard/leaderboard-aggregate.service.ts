import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { PlayerRating } from "../../database/entities/player-rating.entity.js"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import { MatchFormat } from "./leaderboard.types.js"

@Injectable()
export class LeaderboardAggregateService {
    constructor(
        @InjectRepository(PlayerRating)
        private readonly playerRatingRepository: Repository<PlayerRating>,
    ) {}

    async getMainRating(
        guildId: string,
        discordUserId: string,
        config: LeaderboardGuildConfig,
    ): Promise<number> {
        const favoriteFormats = config.favoriteFormats as MatchFormat[]

        if (favoriteFormats.length === 0) {
            return config.initialRating
        }

        const ratings = await this.playerRatingRepository.find({
            where: favoriteFormats.map((format) => ({
                guildId,
                discordUserId,
                format,
            })),
        })

        const ratingByFormat = new Map(
            ratings.map((rating) => [rating.format, rating.rating]),
        )

        const sum = favoriteFormats.reduce(
            (total, format) =>
                total + (ratingByFormat.get(format) ?? config.initialRating),
            0,
        )

        return Math.round(sum / favoriteFormats.length)
    }

    async getTotalVerifiedMatches(
        guildId: string,
        discordUserId: string,
    ): Promise<number> {
        const ratings = await this.playerRatingRepository.find({
            where: { guildId, discordUserId },
        })

        return ratings.reduce(
            (total, rating) => total + rating.verifiedMatchCount,
            0,
        )
    }

    async getFormatRating(
        guildId: string,
        discordUserId: string,
        format: MatchFormat,
        initialRating: number,
    ): Promise<number> {
        const rating = await this.playerRatingRepository.findOne({
            where: { guildId, discordUserId, format },
        })

        return rating?.rating ?? initialRating
    }
}
