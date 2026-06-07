import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
} from "discord.js"
import { replyWithUserError } from "../../../platforms/discord/discord-interaction.util.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { LeaderboardConfigService } from "../config.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    DEFAULT_LEADERBOARD_TOP_SIZE,
    LEADERBOARD_TOP_SIZES,
    MATCH_FORMATS,
    MatchFormat,
    RegisterMatchRoundDto,
} from "../types.js"
import { getHeroAutocompleteChoices } from "../heroes.js"
import { getMapAutocompleteChoices } from "../maps.js"
import { formatRating } from "../rating.util.js"
import { LeaderboardDiscordRoles } from "./roles.js"
import { LeaderboardDiscordPresenter } from "./presenter.js"

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
            this.commandNewRatingMatch(interaction),
        )
        this.discordService.registerAutocomplete(
            "new-rating-match",
            (interaction) => this.autocompleteNewRatingMatch(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-formats",
            (interaction) => this.commandSetupFormats(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-special-roles",
            (interaction) => this.commandSetupSpecialRoles(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-setup-roles",
            (interaction) => this.commandSetupTierRole(interaction),
        )
        this.discordService.registerCommand("leaderboard", (interaction) =>
            this.commandGetPlayerRating(interaction),
        )
        this.discordService.registerCommand("leaderboard-top", (interaction) =>
            this.commandGetTopPlayers(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-welcome",
            (interaction) => this.commandShowWelcome(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-config",
            (interaction) => this.commandShowGuildConfig(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-reset-rating",
            (interaction) => this.commandResetPlayerRating(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-reset-stats",
            (interaction) => this.commandResetPlayerStats(interaction),
        )
    }

    //У slash-команды максимум 25 опций.
    private async autocompleteNewRatingMatch(
        interaction: AutocompleteInteraction,
    ): Promise<void> {
        const focused = interaction.options.getFocused(true)

        const query = typeof focused.value === "string" ? focused.value : ""

        if (focused.name.startsWith("map_")) {
            await interaction.respond(getMapAutocompleteChoices(query))
            return
        }

        if (
            focused.name.startsWith("p1_hero_") ||
            focused.name.startsWith("p2_hero_")
        ) {
            await interaction.respond(getHeroAutocompleteChoices(query))
            return
        }

        await interaction.respond([])
    }

    private async commandNewRatingMatch(
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
            const rounds = this.collectRounds(
                interaction,
                playerOne.id,
                playerTwo.id,
            )

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

    private async commandSetupFormats(
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

    private async commandSetupSpecialRoles(
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

    private async commandSetupTierRole(
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

    private async commandGetPlayerRating(
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
            ({ format, rating }) => `${format}: ${formatRating(rating)}`,
        )

        await interaction.reply({
            content: [
                `**Рейтинг ${target.toString()}**`,
                `Основной рейтинг: ${formatRating(summary.state.mainRating)}`,
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

    private async commandGetTopPlayers(
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

    private async commandShowWelcome(
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

    private async commandResetPlayerRating(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        const guildId = interaction.guildId

        if (!guildId) {
            await interaction.reply({
                content: "Guild only command",
                ephemeral: true,
            })
            return
        }

        const target = interaction.options.getUser("player", true)
        const rating = interaction.options.getNumber("rating")

        if (rating !== null && rating < 0) {
            await interaction.reply({
                content: "Rating must be a non-negative number",
                ephemeral: true,
            })
            return
        }

        try {
            const config = await this.configService.requireGuildConfig(guildId)
            const mainRating = await this.leaderboardService.resetPlayerRating(
                guildId,
                target.id,
                rating ?? undefined,
            )
            const appliedRating = rating ?? config.initialRating

            await this.rolesAdapter.syncMembers(
                guildId,
                [target.id],
                (userId) => interaction.guild!.members.fetch(userId),
            )

            await interaction.reply({
                content: [
                    `Rating updated for ${target.toString()}.`,
                    `All formats set to ${formatRating(appliedRating)}, main rating is now ${formatRating(mainRating)}.`,
                ].join(" "),
                ephemeral: true,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-reset-rating",
            })
        }
    }

    private async commandResetPlayerStats(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        const guildId = interaction.guildId

        if (!guildId) {
            await interaction.reply({
                content: "Guild only command",
                ephemeral: true,
            })
            return
        }

        const target = interaction.options.getUser("player", true)

        try {
            await this.leaderboardService.resetPlayerStats(guildId, target.id)

            await this.rolesAdapter.syncMembers(
                guildId,
                [target.id],
                (userId) => interaction.guild!.members.fetch(userId),
            )

            await interaction.reply({
                content: `Statistics reset for ${target.toString()}: verified match counts cleared, last played dates cleared, freeze removed.`,
                ephemeral: true,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-reset-stats",
            })
        }
    }

    private async commandShowGuildConfig(
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

        const config = await this.configService.getOrCreateGuildConfig(guildId)
        const tiers = await this.configService.getTiers(guildId)

        await interaction.reply({
            content: this.presenter.formatGuildConfigContent(config, tiers),
            ephemeral: true,
        })
    }

    private collectRounds(
        interaction: ChatInputCommandInteraction,
        playerOneUserId: string,
        playerTwoUserId: string,
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []
        const playerOneFirstRounds = this.parsePlayerOneFirstRounds(
            interaction.options.getString("p1_first_rounds"),
        )

        for (let roundNumber = 1; roundNumber <= 5; roundNumber++) {
            const mapName = interaction.options.getString(`map_${roundNumber}`)
            const winner = interaction.options.getUser(
                `round_${roundNumber}_winner`,
            )
            const playerOneHeroName = interaction.options.getString(
                `p1_hero_${roundNumber}`,
            )
            const playerTwoHeroName = interaction.options.getString(
                `p2_hero_${roundNumber}`,
            )

            if (
                !mapName &&
                !winner &&
                !playerOneHeroName &&
                !playerTwoHeroName
            ) {
                continue
            }

            if (
                !mapName ||
                !winner ||
                !playerOneHeroName ||
                !playerTwoHeroName
            ) {
                throw new Error(
                    `Round ${roundNumber} requires map, winner, and both heroes`,
                )
            }

            rounds.push({
                roundNumber,
                winnerUserId: winner.id,
                mapName,
                playerOneHeroName,
                playerTwoHeroName,
                firstPlayerUserId: playerOneFirstRounds.has(roundNumber)
                    ? playerOneUserId
                    : playerTwoUserId,
            })
        }

        return rounds
    }

    private parsePlayerOneFirstRounds(raw: string | null): Set<number> {
        if (!raw?.trim()) {
            return new Set()
        }

        return new Set(
            raw
                .split(",")
                .map((value) => Number.parseInt(value.trim(), 10))
                .filter(
                    (roundNumber) =>
                        Number.isInteger(roundNumber) &&
                        roundNumber >= 1 &&
                        roundNumber <= 5,
                ),
        )
    }

    private isAdmin(interaction: ChatInputCommandInteraction): boolean {
        const member = interaction.member

        if (!member || typeof member.permissions === "string") {
            return false
        }

        return member.permissions.has(PermissionFlagsBits.Administrator)
    }
}
