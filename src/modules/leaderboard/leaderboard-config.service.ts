import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import { RatingTierRole } from "../../database/entities/rating-tier-role.entity.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    MATCH_FORMATS,
    MatchFormat,
} from "./leaderboard.types.js"

@Injectable()
export class LeaderboardConfigService {
    constructor(
        @InjectRepository(LeaderboardGuildConfig)
        private readonly configRepository: Repository<LeaderboardGuildConfig>,
        @InjectRepository(RatingTierRole)
        private readonly tierRepository: Repository<RatingTierRole>,
    ) {}

    async getOrCreateGuildConfig(
        guildId: string,
    ): Promise<LeaderboardGuildConfig> {
        let config = await this.configRepository.findOne({
            where: { guildId },
        })

        if (!config) {
            config = await this.configRepository.save(
                this.configRepository.create({
                    guildId,
                    favoriteFormats: [...MATCH_FORMATS],
                }),
            )
            await this.seedDefaultTiers(guildId)
        }

        return config
    }

    async setFavoriteFormats(
        guildId: string,
        formats: MatchFormat[],
    ): Promise<LeaderboardGuildConfig> {
        const config = await this.getOrCreateGuildConfig(guildId)
        config.favoriteFormats = formats
        return this.configRepository.save(config)
    }

    async setSpecialRoles(
        guildId: string,
        calibrationRoleId: string,
        freezeRoleId: string,
    ): Promise<LeaderboardGuildConfig> {
        const config = await this.getOrCreateGuildConfig(guildId)
        config.calibrationRoleId = calibrationRoleId
        config.freezeRoleId = freezeRoleId
        return this.configRepository.save(config)
    }

    async setTierRole(
        guildId: string,
        tierName: string,
        roleId: string,
    ): Promise<RatingTierRole> {
        await this.getOrCreateGuildConfig(guildId)

        let tier = await this.tierRepository.findOne({
            where: { guildId, name: tierName },
        })

        if (!tier) {
            const definition = DEFAULT_TIER_DEFINITIONS.find(
                (item) => item.name === tierName,
            )

            if (!definition) {
                throw new Error(`Unknown tier: ${tierName}`)
            }

            tier = this.tierRepository.create({
                guildId,
                name: tierName,
                minRating: definition.minRating,
                maxRating: definition.maxRating,
                roleId,
            })
        } else {
            tier.roleId = roleId
        }

        return this.tierRepository.save(tier)
    }

    async getTiers(guildId: string): Promise<RatingTierRole[]> {
        await this.getOrCreateGuildConfig(guildId)
        return this.tierRepository.find({
            where: { guildId },
            order: { minRating: "ASC" },
        })
    }

    async getGuildConfig(
        guildId: string,
    ): Promise<LeaderboardGuildConfig | null> {
        return this.configRepository.findOne({ where: { guildId } })
    }

    requireGuildConfig(guildId: string): Promise<LeaderboardGuildConfig> {
        return this.getOrCreateGuildConfig(guildId)
    }

    private async seedDefaultTiers(guildId: string): Promise<void> {
        for (const tier of DEFAULT_TIER_DEFINITIONS) {
            const existing = await this.tierRepository.findOne({
                where: { guildId, name: tier.name },
            })

            if (existing) {
                continue
            }

            await this.tierRepository.save(
                this.tierRepository.create({
                    guildId,
                    name: tier.name,
                    minRating: tier.minRating,
                    maxRating: tier.maxRating,
                    roleId: null,
                }),
            )
        }
    }
}
