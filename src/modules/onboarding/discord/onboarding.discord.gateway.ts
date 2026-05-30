import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    User,
} from "discord.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { OnboardingService } from "../onboarding.service.js"

@Injectable()
export class OnboardingDiscordGateway implements OnModuleInit {
    private readonly logger = new Logger(OnboardingDiscordGateway.name)

    constructor(
        private readonly discordService: DiscordService,
        private readonly onboardingService: OnboardingService,
    ) {}

    onModuleInit(): void {
        this.discordService.client.on(
            "messageReactionAdd",
            (reaction, user) => {
                void this.handleReactionAdd(reaction, user)
            },
        )

        this.discordService.client.on(
            "messageReactionRemove",
            (reaction, user) => {
                void this.handleReactionRemove(reaction, user)
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

            const fetchedReaction = await this.fetchReaction(reaction)
            const guild = fetchedReaction.message.guild

            if (!guild) {
                return
            }

            const emojiName = fetchedReaction.emoji.name

            if (!emojiName) {
                return
            }

            const rule = await this.onboardingService.findRule(
                guild.id,
                fetchedReaction.message.id,
                emojiName,
            )

            if (!rule) {
                return
            }

            const member = await guild.members.fetch(user.id)
            const hasRole = member.roles.cache.has(rule.roleId)

            if (!this.onboardingService.shouldGrantRole(rule, hasRole)) {
                return
            }

            await member.roles.add(rule.roleId)
            this.logger.log(`Role ${rule.roleId} added to user ${user.id}`)
        } catch (error) {
            this.logger.error(error)
        }
    }

    private async handleReactionRemove(
        reaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser,
    ): Promise<void> {
        try {
            if (user.bot) {
                return
            }

            const fetchedReaction = await this.fetchReaction(reaction)
            const guild = fetchedReaction.message.guild

            if (!guild) {
                return
            }

            const emojiName = fetchedReaction.emoji.name

            if (!emojiName) {
                return
            }

            const rule = await this.onboardingService.findRule(
                guild.id,
                fetchedReaction.message.id,
                emojiName,
            )

            if (!rule) {
                return
            }

            const member = await guild.members.fetch(user.id)
            const roleIds = member.roles.cache.map((role) => role.id)
            const rolesToRemove = this.onboardingService.getRoleRemovalPlan(
                rule,
                roleIds,
            )

            if (rolesToRemove.length === 0) {
                return
            }

            await member.roles.remove(rolesToRemove)
            this.logger.log(`Roles removed from user ${user.id}`)
        } catch (error) {
            this.logger.error(error)
        }
    }

    private async fetchReaction(
        reaction: MessageReaction | PartialMessageReaction,
    ): Promise<MessageReaction> {
        if (!reaction.partial) {
            return reaction
        }

        return reaction.fetch()
    }
}
