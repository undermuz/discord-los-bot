import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
} from "discord.js"
import { replyWithUserError } from "../../../platforms/discord/discord-interaction.util.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { LeaderboardConfigService } from "../leaderboard-config.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    DEFAULT_LEADERBOARD_TOP_SIZE,
    LEADERBOARD_TOP_SIZES,
    MATCH_FORMATS,
    MatchFormat,
    RegisterMatchRoundDto,
} from "../leaderboard.types.js"
import { LeaderboardDiscordRoles } from "./leaderboard.discord.roles.js"
import { LeaderboardDiscordPresenter } from "./leaderboard.discord.presenter.js"

@Injectable()
export class LeaderboardDiscordCommands implements OnModuleInit {
    private readonly logger = new Logger(LeaderboardDiscordCommands.name)

    constructor(
        private readonly discordService: DiscordService,
        private readonly leaderboardService: LeaderboardService,
        private readonly configService: LeaderboardConfigService,
        private readonly rolesAdapter: LeaderboardDiscordRoles,
        private readonly presenter: LeaderboardDiscordPresenter,
    ) {}

    onModuleInit(): void {
        this.discordService.registerCommand("new-rating-match", (interaction) =>
            this.handleNewRatingMatch(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-formats",
            (interaction) => this.handleSetupFormats(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-special-roles",
            (interaction) => this.handleSetupSpecialRoles(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-roles",
            (interaction) => this.handleSetupTierRole(interaction),
        )
        this.discordService.registerCommand("leaderboard", (interaction) =>
            this.handleLeaderboard(interaction),
        )
        this.discordService.registerCommand("leaderboard-top", (interaction) =>
            this.handleLeaderboardTop(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-welcome",
            (interaction) => this.handleLeaderboardWelcome(interaction),
        )
    }

    private async handleNewRatingMatch(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { guild, channel, options, user } = interaction

        if (!guild || !channel?.isTextBased()) {
            await interaction.reply({
                content: "This command can only be used in a text channel",
                ephemeral: true,
            })
            return
        }

        const format = options.getString("format", true) as MatchFormat
        const playerOne = options.getUser("player_1", true)
        const playerTwo = options.getUser("player_2", true)

        if (!MATCH_FORMATS.includes(format)) {
            await interaction.reply({
                content: "Invalid match format",
                ephemeral: true,
            })
            return
        }

        try {
            const rounds = this.collectRounds(interaction)

            const match = await this.leaderboardService.registerMatch({
                guildId: guild.id,
                channelId: channel.id,
                registeredByUserId: user.id,
                format,
                playerOneUserId: playerOne.id,
                playerTwoUserId: playerTwo.id,
                rounds,
            })

            const display = await this.leaderboardService.getMatchDisplayData(
                match.id,
            )

            const content = this.presenter.formatMatchContent(display)

            const message = await (channel as TextChannel).send(content)
            await message.react(display.config.verifyEmoji)
            await this.leaderboardService.attachMessageId(match.id, message.id)

            await interaction.reply({
                content: `Match registered: ${message.url}`,
                ephemeral: true,
            })

            if (display.pendingUsers.length === 0) {
                const finalized = await this.leaderboardService.finalizeMatch(
                    match.id,
                )

                await this.rolesAdapter.syncMembers(
                    guild.id,
                    [finalized.winnerUserId, finalized.loserUserId],
                    (userId) => guild.members.fetch(userId),
                )

                await this.presenter.refreshMatchMessage(message, match.id)
            }
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "new-rating-match",
            })
        }
    }

    private async handleSetupFormats(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        const formats = MATCH_FORMATS.filter(
            (format) =>
                interaction.options.getBoolean(format.toLowerCase()) === true,
        ) as MatchFormat[]

        if (formats.length === 0) {
            await interaction.reply({
                content: "Select at least one favorite format",
                ephemeral: true,
            })
            return
        }

        const config = await this.configService.setFavoriteFormats(
            interaction.guildId!,
            formats,
        )

        await interaction.reply({
            content: `Favorite formats updated: ${config.favoriteFormats.join(", ")}`,
            ephemeral: true,
        })
    }

    private async handleSetupSpecialRoles(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        const calibrationRole = interaction.options.getRole(
            "calibration_role",
            true,
        )
        const freezeRole = interaction.options.getRole("freeze_role", true)

        await this.configService.setSpecialRoles(
            interaction.guildId!,
            calibrationRole.id,
            freezeRole.id,
        )

        await interaction.reply({
            content: "Calibration and freeze roles updated",
            ephemeral: true,
        })
    }

    private async handleSetupTierRole(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        const tierName = interaction.options.getString("tier", true)
        const role = interaction.options.getRole("role", true)

        if (!DEFAULT_TIER_DEFINITIONS.some((tier) => tier.name === tierName)) {
            await interaction.reply({
                content: "Unknown tier name",
                ephemeral: true,
            })
            return
        }

        await this.configService.setTierRole(
            interaction.guildId!,
            tierName,
            role.id,
        )

        await interaction.reply({
            content: `Tier ${tierName} mapped to ${role.name}`,
            ephemeral: true,
        })
    }

    private async handleLeaderboard(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const guildId = interaction.guildId

        if (!guildId) {
            await interaction.reply({
                content: "Guild only command",
                ephemeral: true,
            })
            return
        }

        const target = interaction.options.getUser("player") ?? interaction.user
        const summary =
            await this.leaderboardService.getPlayerLeaderboardSummary(
                guildId,
                target.id,
            )

        const formatLines = summary.formatRatings.map(
            ({ format, rating }) => `${format}: ${rating}`,
        )

        await interaction.reply({
            content: [
                `**Рейтинг ${target.toString()}**`,
                `Основной рейтинг: ${summary.state.mainRating}`,
                `Матчей: ${summary.state.totalVerifiedMatches}`,
                summary.state.isFrozen ? "Статус: Заморозка" : "",
                "",
                ...formatLines,
            ]
                .filter(Boolean)
                .join("\n"),
            ephemeral: true,
        })
    }

    private async handleLeaderboardTop(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const guildId = interaction.guildId

        if (!guildId) {
            await interaction.reply({
                content: "Guild only command",
                ephemeral: true,
            })
            return
        }

        const requestedSize =
            interaction.options.getInteger("size") ??
            DEFAULT_LEADERBOARD_TOP_SIZE

        const size = LEADERBOARD_TOP_SIZES.includes(
            requestedSize as (typeof LEADERBOARD_TOP_SIZES)[number],
        )
            ? requestedSize
            : DEFAULT_LEADERBOARD_TOP_SIZE

        const entries = await this.leaderboardService.getTopPlayers(
            guildId,
            size,
        )

        await interaction.reply({
            content: this.presenter.formatTopLeaderboardContent(size, entries),
            ephemeral: true,
        })
    }

    private async handleLeaderboardWelcome(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "Guild only command",
                ephemeral: true,
            })
            return
        }

        await interaction.reply({
            content: this.presenter.formatWelcomeContent(),
        })
    }

    private collectRounds(
        interaction: ChatInputCommandInteraction,
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []

        for (let roundNumber = 1; roundNumber <= 5; roundNumber++) {
            const mapName = interaction.options.getString(`map_${roundNumber}`)
            const winner = interaction.options.getUser(
                `round_${roundNumber}_winner`,
            )

            if (!mapName && !winner) {
                continue
            }

            if (!mapName || !winner) {
                throw new Error(
                    `Round ${roundNumber} requires both map and winner`,
                )
            }

            rounds.push({
                roundNumber,
                winnerUserId: winner.id,
                mapName,
            })
        }

        return rounds
    }

    private isAdmin(interaction: ChatInputCommandInteraction): boolean {
        const member = interaction.member

        if (!member || typeof member.permissions === "string") {
            return false
        }

        return member.permissions.has(PermissionFlagsBits.Administrator)
    }
}
