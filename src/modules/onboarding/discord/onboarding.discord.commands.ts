import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ChatInputCommandInteraction } from "discord.js"
import { replyWithUserError } from "../../../platforms/discord/discord-interaction.util.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { OnboardingService } from "../onboarding.service.js"

@Injectable()
export class OnboardingDiscordCommands implements OnModuleInit {
    private readonly logger = new Logger(OnboardingDiscordCommands.name)

    constructor(
        private readonly discordService: DiscordService,
        private readonly onboardingService: OnboardingService,
    ) {}

    onModuleInit(): void {
        this.discordService.registerCommand(
            "exchange-emoji-to-role",
            (interaction) => this.handleExchangeEmojiToRole(interaction),
        )

        this.discordService.registerCommand(
            "cancel-exchange-emoji-to-role",
            (interaction) => this.handleCancelExchangeEmojiToRole(interaction),
        )
    }

    private async handleExchangeEmojiToRole(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { channel, guild, options } = interaction

        if (!guild || !channel?.isTextBased()) {
            await interaction.reply({
                content: "This command can only be used in a text channel",
                ephemeral: true,
            })
            return
        }

        const role = options.getRole("role", true)
        const emoji = options.getString("emoji", true)
        const messageId = options.getString("message-id", true)
        const removeAllRoles = options.getBoolean("remove-all-roles") ?? false

        const messageLink = `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`

        try {
            await channel.messages.fetch(messageId)
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "exchange-emoji-to-role:fetch-message",
            })
            return
        }

        try {
            await this.onboardingService.createRule({
                guildId: guild.id,
                roleId: role.id,
                emoji,
                messageId,
                removeAllRoles,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "exchange-emoji-to-role",
            })
            return
        }

        await interaction.reply({
            content: `Everyone who react ${emoji} to message ${messageLink} will receive ${role.name}`,
            ephemeral: true,
        })

        if (removeAllRoles) {
            await interaction.followUp({
                content: `Everyone who remove react ${emoji} from message ${messageLink} will lose all roles`,
                ephemeral: true,
            })
        }
    }

    private async handleCancelExchangeEmojiToRole(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { channel, guild, options } = interaction

        if (!guild || !channel) {
            await interaction.reply({
                content: "This command can only be used in a guild channel",
                ephemeral: true,
            })
            return
        }

        const messageId = options.getString("message-id", true)
        const messageLink = `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`

        try {
            await this.onboardingService.deleteRulesByMessageId(
                guild.id,
                messageId,
            )
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "cancel-exchange-emoji-to-role",
            })
            return
        }

        await interaction.reply({
            content: `Exchange effect for message ${messageLink} has canceled`,
            ephemeral: true,
        })
    }
}
