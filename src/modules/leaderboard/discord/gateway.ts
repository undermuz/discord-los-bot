import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    User,
} from "discord.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { LeaderboardConfigService } from "../config.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchStatus } from "../types.js"
import { LeaderboardDiscordRoles } from "./roles.js"
import { LeaderboardDiscordPresenter } from "./presenter.js"

@Injectable()
export class LeaderboardDiscordGateway implements OnModuleInit {
    private readonly logger = new Logger(LeaderboardDiscordGateway.name)

    constructor(
        private readonly discordService: DiscordService,
        private readonly leaderboardService: LeaderboardService,
        private readonly configService: LeaderboardConfigService,
        private readonly rolesAdapter: LeaderboardDiscordRoles,
        private readonly presenter: LeaderboardDiscordPresenter,
    ) {}

    onModuleInit(): void {
        this.discordService.client.on(
            "messageReactionAdd",
            (reaction, user) => {
                void this.handleReactionAdd(reaction, user)
            },
        )
    }

    private async handleReactionAdd(
        reaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser,
    ): Promise<void> {
        try {
            if (user.bot) {
                return
            }

            const fetchedReaction = reaction.partial
                ? await reaction.fetch()
                : reaction
            const guild = fetchedReaction.message.guild

            if (!guild) {
                return
            }

            const emojiName = fetchedReaction.emoji.name

            if (!emojiName) {
                return
            }

            const config = await this.configService.getGuildConfig(guild.id)

            if (!config || emojiName !== config.verifyEmoji) {
                return
            }

            const match = await this.leaderboardService.findMatchByMessage(
                guild.id,
                fetchedReaction.message.id,
            )

            if (!match) {
                return
            }

            const finalized = await this.leaderboardService.confirmMatch(
                guild.id,
                fetchedReaction.message.id,
                user.id,
            )

            if (!finalized) {
                return
            }

            await this.presenter.refreshMatchMessage(
                fetchedReaction.message,
                finalized.id,
            )

            if (finalized.status !== MatchStatus.Verified) {
                return
            }

            await this.rolesAdapter.syncMembers(
                guild.id,
                [finalized.winnerUserId, finalized.loserUserId],
                (userId) => guild.members.fetch(userId),
            )

            this.logger.log(`Match ${finalized.id} verified and applied`)
        } catch (error) {
            this.logger.error(error)
        }
    }
}
