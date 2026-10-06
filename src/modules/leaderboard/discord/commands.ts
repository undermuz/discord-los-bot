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
    DUEL_MATCH_FORMATS,
    LEADERBOARD_TOP_SIZES,
    formatRequiresHeroes,
    MATCH_FORMATS,
    MatchFormat,
    RegisterMatchRoundDto,
    SERIES_LENGTHS,
    SeriesLength,
    TWO_VS_TWO_SERIES_LENGTHS,
} from "../types.js"
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
        this.discordService.registerCommand("new-2x2", (interaction) =>
            this.commandNew2x2(interaction),
        )
        this.discordService.registerAutocomplete(
            "new-rating-match",
            (interaction) => this.autocompleteMatchFields(interaction),
        )
        this.discordService.registerAutocomplete("um-1x1", (interaction) =>
            this.autocompleteMatchFields(interaction),
        )
        this.discordService.registerAutocomplete("new-2x2", (interaction) =>
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
            !DUEL_MATCH_FORMATS.includes(format) ||
            !SERIES_LENGTHS.includes(seriesLength)
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
                5,
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

    private async commandNew2x2(
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

        const seriesLength = options.getString("series", true) as SeriesLength
        const teamOnePlayer = options.getUser("team1_p1", true)
        const teamOnePartner = options.getUser("team1_p2", true)
        const teamTwoPlayer = options.getUser("team2_p1", true)
        const teamTwoPartner = options.getUser("team2_p2", true)

        if (!TWO_VS_TWO_SERIES_LENGTHS.includes(seriesLength)) {
            await interaction.reply({
                content: "Invalid match series",
                ephemeral: true,
            })
            return
        }

        try {
            const rounds = this.collectTeamRounds(
                interaction,
                teamOnePlayer.id,
                teamTwoPlayer.id,
            )

            await this.postRegisteredMatch(interaction, {
                format: MatchFormat.TwoVsTwo,
                seriesLength,
                playerOneUserId: teamOnePlayer.id,
                playerOnePartnerUserId: teamOnePartner.id,
                playerTwoUserId: teamTwoPlayer.id,
                playerTwoPartnerUserId: teamTwoPartner.id,
                rounds,
                context: "new-2x2",
            })
        } catch (error) {
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: "new-2x2",
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
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []
        const playerOneFirstRounds = this.parsePlayerOneFirstRounds(
            interaction.options.getString("p1_first_rounds"),
            maxRounds,
        )

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

            if (
                !mapName &&
                !winner &&
                !playerOneHeroName &&
                !playerTwoHeroName
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
                firstPlayerUserId: playerOneFirstRounds.has(roundNumber)
                    ? playerOneUserId
                    : playerTwoUserId,
            })
        }

        return rounds
    }

    private collectTeamRounds(
        interaction: ChatInputCommandInteraction,
        teamOnePrimaryUserId: string,
        teamTwoPrimaryUserId: string,
    ): RegisterMatchRoundDto[] {
        const rounds: RegisterMatchRoundDto[] = []
        const teamOneFirstRounds = this.parsePlayerOneFirstRounds(
            interaction.options.getString("team1_first_rounds"),
            3,
        )

        for (let roundNumber = 1; roundNumber <= 3; roundNumber++) {
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
                firstPlayerUserId: teamOneFirstRounds.has(roundNumber)
                    ? teamOnePrimaryUserId
                    : teamTwoPrimaryUserId,
            })
        }

        return rounds
    }

    private parsePlayerOneFirstRounds(
        raw: string | null,
        maxRounds: number,
    ): Set<number> {
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
                        roundNumber <= maxRounds,
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
