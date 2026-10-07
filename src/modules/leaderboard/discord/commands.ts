import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
} from "discord.js"
import { replyWithUserError } from "../../../platforms/discord/discord-interaction.util.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { LeaderboardCatalogService } from "../catalog.service.js"
import { LeaderboardConfigService } from "../config.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    DEFAULT_LEADERBOARD_TOP_SIZE,
    FixedRegistrationCommand,
    LEADERBOARD_TOP_SIZES,
    formatRequiresHeroes,
    formatTeamSize,
    duelUsesPerRoundFirstPlayer,
    fixedRegistrationCommands,
    isFormatSeriesAllowed,
    MATCH_FORMATS,
    MatchFormat,
    RegisterMatchRoundDto,
    SeriesLength,
    seriesRoundCount,
    universalMatchFormats,
    universalMatchSeries,
} from "../types.js"
import { formatRating } from "../rating.util.js"
import { LeaderboardDiscordRoles } from "./roles.js"
import { LeaderboardDiscordPresenter } from "./presenter.js"

type FirstMoveMode = "player-one" | "per-round" | "ordered"

const FIXED_DUEL_LEADING_OPTIONS = 2
const UNIVERSAL_MATCH_LEADING_OPTIONS = 4

@Injectable()
export class LeaderboardDiscordCommands implements OnModuleInit {
    private readonly logger = new Logger(LeaderboardDiscordCommands.name)

    constructor(
        private readonly discordService: DiscordService,
        private readonly leaderboardService: LeaderboardService,
        private readonly configService: LeaderboardConfigService,
        private readonly catalogService: LeaderboardCatalogService,
        private readonly rolesAdapter: LeaderboardDiscordRoles,
        private readonly presenter: LeaderboardDiscordPresenter,
    ) {}

    onModuleInit(): void {
        this.discordService.registerCommand("new-rating-match", (interaction) =>
            this.commandNewRatingMatch(interaction),
        )
        this.discordService.registerCommand("um-1x1", (interaction) =>
            this.commandUm1x1(interaction),
        )
        for (const spec of fixedRegistrationCommands()) {
            this.discordService.registerCommand(spec.name, (interaction) =>
                this.commandFixedRegistration(interaction, spec),
            )
            this.discordService.registerAutocomplete(spec.name, (interaction) =>
                this.autocompleteMatchFields(interaction),
            )
        }
        this.discordService.registerAutocomplete(
            "new-rating-match",
            (interaction) => this.autocompleteMatchFields(interaction),
        )
        this.discordService.registerAutocomplete("um-1x1", (interaction) =>
            this.autocompleteMatchFields(interaction),
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
            "leaderboard-matches",
            (interaction) => this.commandRecentMatches(interaction),
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
            "leaderboard-adjust-rating",
            (interaction) => this.commandAdjustPlayerRating(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-reset-stats",
            (interaction) => this.commandResetPlayerStats(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-freeze-player",
            (interaction) => this.commandFreezePlayer(interaction),
        )
        this.discordService.registerCommand(
            "leaderboard-reset-cache",
            (interaction) => this.commandResetCatalogCache(interaction),
        )
    }

    //У slash-команды максимум 25 опций.
    private async autocompleteMatchFields(
        interaction: AutocompleteInteraction,
    ): Promise<void> {
        const focused = interaction.options.getFocused(true)

        const query = typeof focused.value === "string" ? focused.value : ""

        if (focused.name.startsWith("map")) {
            await interaction.respond(
                this.catalogService.getMapAutocompleteChoices(query),
            )
            return
        }

        if (focused.name.includes("hero")) {
            await interaction.respond(
                this.catalogService.getHeroAutocompleteChoices(query),
            )
            return
        }

        await interaction.respond([])
    }

    private async commandNewRatingMatch(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { guild, channel, options } = interaction

        if (!guild || !channel?.isTextBased()) {
            await interaction.reply({
                content: "This command can only be used in a text channel",
                ephemeral: true,
            })
            return
        }

        const format = options.getString("format", true) as MatchFormat
        const seriesLength = options.getString("series", true) as SeriesLength
        const playerOne = options.getUser("player_1", true)
        const playerTwo = options.getUser("player_2", true)

        if (
            !universalMatchFormats().includes(format) ||
            !isFormatSeriesAllowed(format, seriesLength)
        ) {
            await interaction.reply({
                content: "Invalid match format",
                ephemeral: true,
            })
            return
        }

        try {
            const rounds = this.collectRounds(
                interaction,
                format,
                playerOne.id,
                playerTwo.id,
                seriesRoundCount(seriesLength),
                this.firstMoveMode(
                    seriesLength,
                    this.universalMatchRoundCount(),
                    UNIVERSAL_MATCH_LEADING_OPTIONS,
                ),
            )

            await this.postRegisteredMatch(interaction, {
                format,
                seriesLength,
                playerOneUserId: playerOne.id,
                playerOnePartnerUserId: null,
                playerTwoUserId: playerTwo.id,
                playerTwoPartnerUserId: null,
                rounds,
                context: "new-rating-match",
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "new-rating-match",
            })
        }
    }

    private async commandUm1x1(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const { guild, channel, options } = interaction

        if (!guild || !channel?.isTextBased()) {
            await interaction.reply({
                content: "This command can only be used in a text channel",
                ephemeral: true,
            })
            return
        }

        const playerOne = options.getUser("p1", true)
        const playerTwo = options.getUser("p2", true)
        const winner = options.getUser("winner", true)
        const mapName = options.getString("map", true)

        await this.postRegisteredMatch(interaction, {
            format: MatchFormat.LosEnduranceAutumn2026,
            seriesLength: SeriesLength.Bo1,
            playerOneUserId: playerOne.id,
            playerOnePartnerUserId: null,
            playerTwoUserId: playerTwo.id,
            playerTwoPartnerUserId: null,
            rounds: [
                {
                    roundNumber: 1,
                    winnerUserId: winner.id,
                    mapName,
                    playerOneHeroName: "",
                    playerTwoHeroName: "",
                    playerOnePartnerHeroName: "",
                    playerTwoPartnerHeroName: "",
                    firstPlayerUserId: playerOne.id,
                },
            ],
            context: "um-1x1",
        })
    }

    private async commandFixedRegistration(
        interaction: ChatInputCommandInteraction,
        spec: FixedRegistrationCommand,
    ): Promise<void> {
        const { guild, channel, options } = interaction

        if (!guild || !channel?.isTextBased()) {
            await interaction.reply({
                content: "This command can only be used in a text channel",
                ephemeral: true,
            })
            return
        }

        const maxRounds = seriesRoundCount(spec.seriesLength)

        try {
            if (formatTeamSize(spec.format) === 2) {
                const teamOnePlayer = options.getUser("team1_p1", true)
                const teamOnePartner = options.getUser("team1_p2", true)
                const teamTwoPlayer = options.getUser("team2_p1", true)
                const teamTwoPartner = options.getUser("team2_p2", true)
                const rounds = this.collectTeamRounds(
                    interaction,
                    teamOnePlayer.id,
                    teamTwoPlayer.id,
                    maxRounds,
                )

                await this.postRegisteredMatch(interaction, {
                    format: spec.format,
                    seriesLength: spec.seriesLength,
                    playerOneUserId: teamOnePlayer.id,
                    playerOnePartnerUserId: teamOnePartner.id,
                    playerTwoUserId: teamTwoPlayer.id,
                    playerTwoPartnerUserId: teamTwoPartner.id,
                    rounds,
                    context: spec.name,
                })
                return
            }

            const playerOne = options.getUser("player_1", true)
            const playerTwo = options.getUser("player_2", true)
            const rounds = this.collectRounds(
                interaction,
                spec.format,
                playerOne.id,
                playerTwo.id,
                maxRounds,
                this.firstMoveMode(
                    spec.seriesLength,
                    maxRounds,
                    FIXED_DUEL_LEADING_OPTIONS,
                ),
            )

            await this.postRegisteredMatch(interaction, {
                format: spec.format,
                seriesLength: spec.seriesLength,
                playerOneUserId: playerOne.id,
                playerOnePartnerUserId: null,
                playerTwoUserId: playerTwo.id,
                playerTwoPartnerUserId: null,
                rounds,
                context: spec.name,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: spec.name,
            })
        }
    }

    private async postRegisteredMatch(
        interaction: ChatInputCommandInteraction,
        input: {
            format: MatchFormat
            seriesLength: SeriesLength
            playerOneUserId: string
            playerOnePartnerUserId: string | null
            playerTwoUserId: string
            playerTwoPartnerUserId: string | null
            rounds: RegisterMatchRoundDto[]
            context: string
        },
    ): Promise<void> {
        const { guild, channel, user } = interaction

        if (!guild || !channel?.isTextBased()) {
            return
        }

        try {
            const match = await this.leaderboardService.registerMatch({
                guildId: guild.id,
                channelId: channel.id,
                registeredByUserId: user.id,
                format: input.format,
                seriesLength: input.seriesLength,
                playerOneUserId: input.playerOneUserId,
                playerOnePartnerUserId: input.playerOnePartnerUserId,
                playerTwoUserId: input.playerTwoUserId,
                playerTwoPartnerUserId: input.playerTwoPartnerUserId,
                rounds: input.rounds,
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
                    this.leaderboardService.getRequiredParticipants(finalized),
                    (userId) => guild.members.fetch(userId),
                )

                await this.presenter.refreshMatchMessage(message, match.id)
            }
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: input.context,
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
            ({ format, rating, k1, k2 }) =>
                `${format}: ${formatRating(rating)} | K1: ${formatRating(k1)} | K2: ${formatRating(k2)}`,
        )

        await interaction.reply({
            content: [
                `**Рейтинг ${target.toString()}**`,
                `Основной рейтинг: ${formatRating(summary.state.mainRating)}`,
                `Матчей: ${summary.state.totalVerifiedMatches}`,
                summary.state.isFrozen ? "Статус: Заморозка" : "",
                "K1 — при победе, K2 — калибровка (3 — впервые, 2 — повторно)",
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

    private async commandRecentMatches(
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

        const target = interaction.options.getUser("player")
        const fromRaw = interaction.options.getString("from")
        const from = fromRaw ? this.parseFromDate(fromRaw) : undefined

        if (from === null) {
            await interaction.reply({
                content: "Дата должна быть в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ",
                ephemeral: true,
            })
            return
        }

        try {
            const entries = await this.leaderboardService.getRecentMatches(
                guildId,
                {
                    discordUserId: target?.id,
                    from,
                },
            )
            const messages = this.packDiscordMessages(
                this.presenter.formatRecentMatchBlocks(entries, {
                    discordUserId: target?.id,
                    from,
                }),
            )
            const [first, ...rest] = messages

            await interaction.reply({ content: first })

            for (const content of rest) {
                await interaction.followUp({ content })
            }
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-matches",
            })
        }
    }

    private async commandAdjustPlayerRating(
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
        const delta = interaction.options.getNumber("delta", true)
        const formatRaw = interaction.options.getString("format")
        const format = (MATCH_FORMATS as readonly string[]).includes(
            formatRaw ?? "",
        )
            ? (formatRaw as MatchFormat)
            : undefined

        if (formatRaw && !format) {
            await interaction.reply({
                content: "Unknown format",
                ephemeral: true,
            })
            return
        }

        try {
            const adjustment = await this.leaderboardService.adjustPlayerRating(
                guildId,
                target.id,
                delta,
                format,
            )

            await this.rolesAdapter.syncMembers(
                guildId,
                [target.id],
                (userId) => interaction.guild!.members.fetch(userId),
            )

            const sign = adjustment.delta > 0 ? "+" : ""
            const formatLines = adjustment.formatRatings
                .map((item) => `${item.format}: ${formatRating(item.rating)}`)
                .join(", ")

            await interaction.reply({
                content: [
                    `Rating adjusted for ${target.toString()} by ${sign}${formatRating(adjustment.delta)}.`,
                    formatLines,
                    `Main rating is now ${formatRating(adjustment.mainRating)}.`,
                ].join(" "),
                ephemeral: true,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-adjust-rating",
            })
        }
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
        const resetCalibration =
            interaction.options.getBoolean("reset_calibration") === true

        try {
            await this.leaderboardService.resetPlayerStats(
                guildId,
                target.id,
                resetCalibration,
            )

            await this.rolesAdapter.syncMembers(
                guildId,
                [target.id],
                (userId) => interaction.guild!.members.fetch(userId),
            )

            const calibrationNote = resetCalibration
                ? ", calibration history cleared"
                : ""

            await interaction.reply({
                content: `Statistics reset for ${target.toString()}: verified match counts cleared, last played dates cleared, freeze removed${calibrationNote}.`,
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

    private async commandResetCatalogCache(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        if (!this.isAdmin(interaction)) {
            await interaction.reply({
                content: "Administrator permission required",
                ephemeral: true,
            })
            return
        }

        try {
            this.catalogService.resetCache()

            await interaction.reply({
                content: "Maps and heroes cache reloaded",
                ephemeral: true,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-reset-cache",
            })
        }
    }

    private async commandFreezePlayer(
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
            await this.leaderboardService.freezeInactivePlayer(
                guildId,
                target.id,
            )

            await this.rolesAdapter.syncMembers(
                guildId,
                [target.id],
                (userId) => interaction.guild!.members.fetch(userId),
            )

            await interaction.reply({
                content: `Player ${target.toString()} frozen: rating preserved, match counts reset for re-calibration.`,
                ephemeral: true,
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "leaderboard-freeze-player",
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
        format: MatchFormat,
        playerOneUserId: string,
        playerTwoUserId: string,
        maxRounds: number,
        firstMoveMode: FirstMoveMode,
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []
        const orderedFirstMoves =
            firstMoveMode === "ordered"
                ? this.parseOrderedFirstMoves(
                      interaction.options.getString("first_moves"),
                  )
                : []

        for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
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
            const firstPlayer =
                firstMoveMode === "per-round"
                    ? interaction.options.getUser(`round_${roundNumber}_first`)
                    : null

            if (
                !mapName &&
                !winner &&
                !playerOneHeroName &&
                !playerTwoHeroName &&
                !firstPlayer
            ) {
                continue
            }

            const heroesRequired = formatRequiresHeroes(format)

            if (
                !mapName ||
                !winner ||
                (heroesRequired && (!playerOneHeroName || !playerTwoHeroName))
            ) {
                throw new Error(
                    heroesRequired
                        ? `Round ${roundNumber} requires map, winner, and both heroes`
                        : `Round ${roundNumber} requires map and winner`,
                )
            }

            rounds.push({
                roundNumber,
                winnerUserId: winner.id,
                mapName,
                playerOneHeroName: playerOneHeroName ?? "",
                playerTwoHeroName: playerTwoHeroName ?? "",
                playerOnePartnerHeroName: "",
                playerTwoPartnerHeroName: "",
                firstPlayerUserId: this.resolveFirstPlayer(
                    firstMoveMode,
                    roundNumber,
                    playerOneUserId,
                    playerTwoUserId,
                    firstPlayer?.id ?? null,
                    orderedFirstMoves,
                ),
            })
        }

        return rounds
    }

    private collectTeamRounds(
        interaction: ChatInputCommandInteraction,
        teamOnePrimaryUserId: string,
        _teamTwoPrimaryUserId: string,
        maxRounds: number,
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []

        for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
            const mapName = interaction.options.getString(`map_${roundNumber}`)
            const winner = interaction.options.getUser(
                `round_${roundNumber}_winner`,
            )
            const teamOneHero = interaction.options.getString(
                `t1p1_hero_${roundNumber}`,
            )
            const teamOnePartnerHero = interaction.options.getString(
                `t1p2_hero_${roundNumber}`,
            )
            const teamTwoHero = interaction.options.getString(
                `t2p1_hero_${roundNumber}`,
            )
            const teamTwoPartnerHero = interaction.options.getString(
                `t2p2_hero_${roundNumber}`,
            )

            if (
                !mapName &&
                !winner &&
                !teamOneHero &&
                !teamOnePartnerHero &&
                !teamTwoHero &&
                !teamTwoPartnerHero
            ) {
                continue
            }

            if (
                !mapName ||
                !winner ||
                !teamOneHero ||
                !teamOnePartnerHero ||
                !teamTwoHero ||
                !teamTwoPartnerHero
            ) {
                throw new Error(
                    `Round ${roundNumber} requires map, winner, and a hero for each player`,
                )
            }

            rounds.push({
                roundNumber,
                winnerUserId: winner.id,
                mapName,
                playerOneHeroName: teamOneHero,
                playerOnePartnerHeroName: teamOnePartnerHero,
                playerTwoHeroName: teamTwoHero,
                playerTwoPartnerHeroName: teamTwoPartnerHero,
                firstPlayerUserId: teamOnePrimaryUserId,
            })
        }

        return rounds
    }

    private universalMatchRoundCount(): number {
        return Math.max(
            ...universalMatchSeries().map((seriesLength) =>
                seriesRoundCount(seriesLength),
            ),
        )
    }

    private firstMoveMode(
        seriesLength: SeriesLength,
        roundCountOnCommand: number,
        leadingOptions: number,
    ): FirstMoveMode {
        if (seriesLength === SeriesLength.Bo1) {
            return "player-one"
        }

        return duelUsesPerRoundFirstPlayer(roundCountOnCommand, leadingOptions)
            ? "per-round"
            : "ordered"
    }

    private resolveFirstPlayer(
        firstMoveMode: FirstMoveMode,
        roundNumber: number,
        playerOneUserId: string,
        playerTwoUserId: string,
        firstPlayerUserId: string | null,
        orderedFirstMoves: Array<"p1" | "p2">,
    ): string {
        if (firstMoveMode === "player-one") {
            return playerOneUserId
        }

        if (firstMoveMode === "per-round") {
            if (
                firstPlayerUserId !== playerOneUserId &&
                firstPlayerUserId !== playerTwoUserId
            ) {
                throw new Error(
                    `Round ${roundNumber} requires who moved first, and it must be one of the two players`,
                )
            }

            return firstPlayerUserId
        }

        const token = orderedFirstMoves[roundNumber - 1]

        if (!token) {
            throw new Error(
                `Round ${roundNumber} is missing from first_moves. List p1 or p2 for each round, in order`,
            )
        }

        return token === "p1" ? playerOneUserId : playerTwoUserId
    }

    private parseOrderedFirstMoves(raw: string | null): Array<"p1" | "p2"> {
        if (!raw?.trim()) {
            return []
        }

        return raw.split(",").map((token) => {
            const value = token.trim().toLowerCase()

            if (value === "p1" || value === "p2") {
                return value
            }

            throw new Error(
                `Unknown first player "${token.trim()}". Use p1 or p2`,
            )
        })
    }

    private parseFromDate(raw: string): Date | null {
        const trimmed = raw.trim()
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
        const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed)
        const year = iso ? Number(iso[1]) : dotted ? Number(dotted[3]) : null
        const month = iso ? Number(iso[2]) : dotted ? Number(dotted[2]) : null
        const day = iso ? Number(iso[3]) : dotted ? Number(dotted[1]) : null

        if (year === null || month === null || day === null) {
            return null
        }

        const date = new Date(year, month - 1, day)

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null
        }

        return date
    }

    private packDiscordMessages(blocks: string[]): string[] {
        const limit = 2000
        const messages: string[] = []
        let current = ""

        for (const block of blocks) {
            const next = current.length === 0 ? block : `${current}\n\n${block}`

            if (next.length <= limit) {
                current = next
                continue
            }

            if (current.length > 0) {
                messages.push(current)
            }

            current = block
        }

        if (current.length > 0) {
            messages.push(current)
        }

        return messages
    }

    private isAdmin(interaction: ChatInputCommandInteraction): boolean {
        const member = interaction.member

        if (!member || typeof member.permissions === "string") {
            return false
        }

        return member.permissions.has(PermissionFlagsBits.Administrator)
    }
}
