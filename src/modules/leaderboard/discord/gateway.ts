import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    Guild,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    PermissionFlagsBits,
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

            if (!config) {
                return
            }

            if (emojiName === config.rejectEmoji) {
                await this.handleMatchReject(guild, fetchedReaction, user.id)
                return
            }

            if (emojiName === config.verifyEmoji) {
                await this.handleMatchVerify(guild, fetchedReaction, user.id)
            }
        } catch (error) {
            this.logger.error(error)
        }
    }

    private async handleMatchVerify(
        guild: Guild,
        reaction: MessageReaction | PartialMessageReaction,
        userId: string,
    ): Promise<void> {
        const match = await this.leaderboardService.findMatchByMessage(
            guild.id,
            reaction.message.id,
        )

        if (!match) {
            return
        }

        const finalized = await this.leaderboardService.confirmMatch(
            guild.id,
            reaction.message.id,
            userId,
        )

        if (!finalized) {
            return
        }

        await this.presenter.refreshMatchMessage(reaction.message, finalized.id)

        if (finalized.status !== MatchStatus.Verified) {
            return
        }

        await this.rolesAdapter.syncMembers(
            guild.id,
            this.leaderboardService.getRequiredParticipants(finalized),
            (memberId) => guild.members.fetch(memberId),
        )

        this.logger.log(`Match ${finalized.id} verified and applied`)
    }

    private async handleMatchReject(
        guild: Guild,
        reaction: MessageReaction | PartialMessageReaction,
        userId: string,
    ): Promise<void> {
        const cancelled = await this.leaderboardService.cancelMatch(
            guild.id,
            reaction.message.id,
            userId,
            await this.memberIsAdmin(guild, userId),
        )

        if (!cancelled) {
            return
        }

        await this.presenter.refreshMatchMessage(
            reaction.message,
            cancelled.match.id,
        )

        if (cancelled.ratingReverted) {
            await this.rolesAdapter.syncMembers(
                guild.id,
                this.leaderboardService.getRequiredParticipants(
                    cancelled.match,
                ),
                (memberId) => guild.members.fetch(memberId),
            )
        }

        this.logger.log(
            `Match ${cancelled.match.id} cancelled by ${userId}` +
                (cancelled.ratingReverted ? " with rating rollback" : ""),
        )
    }

    private async memberIsAdmin(
        guild: Guild,
        userId: string,
    ): Promise<boolean> {
        try {
            const member = await guild.members.fetch(userId)

            if (typeof member.permissions === "string") {
                return false
            }

            return member.permissions.has(PermissionFlagsBits.Administrator)
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : "unknown error"

            this.logger.warn(
                `Could not resolve permissions for ${userId} in guild ${guild.id}: ${reason}`,
            )
            return false
        }
    }
}
