import "dotenv/config"
import {
    REST,
    Routes,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    PermissionFlagsBits,
} from "discord.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    duelUsesPerRoundFirstPlayer,
    fixedRegistrationCommands,
    formatTeamSize,
    LEADERBOARD_TOP_SIZES,
    MATCH_FORMATS,
    SeriesLength,
    seriesRoundCount,
    universalMatchFormats,
    universalMatchSeries,
} from "../src/modules/leaderboard/types"

type FirstMoveFields = "none" | "per-round" | "ordered"

const { DISCORD_TOKEN, DISCORD_APP_ID, APP_ID } = process.env
const discordAppId = DISCORD_APP_ID ?? APP_ID

if (!DISCORD_TOKEN || !discordAppId) {
    console.error("DISCORD_TOKEN and DISCORD_APP_ID (or APP_ID) are required")
    process.exit(1)
}

const rollsCmd = new SlashCommandBuilder()
    .setName("rolls")
    .setDescription(
        "Get random numbers for mentioned members, min 2 members, max 25 members",
    )
    .addUserOption((option) =>
        option
            .setName("member_1")
            .setDescription("Ex: @user1")
            .setRequired(true),
    )
    .addUserOption((option) =>
        option
            .setName("member_2")
            .setDescription("Ex: @user2")
            .setRequired(true),
    )

for (let i = 3; i <= 25; i++) {
    rollsCmd.addUserOption((option) =>
        option
            .setName(`member_${i}`)
            .setDescription(`Ex: @user${i}`)
            .setRequired(false),
    )
}

const rollChannelCmd = new SlashCommandBuilder()
    .setName("roll-channel")
    .setDescription(
        "Get random numbers for mentioned channel's member, min 2 members, max 25 members",
    )
    .addChannelOption((option) =>
        option
            .setName("roll_channel")
            .setDescription("Ex: @channel")
            .setRequired(true),
    )

for (let i = 2; i <= 25; i++) {
    rollChannelCmd.addUserOption((option) =>
        option
            .setName(`exclude_member_${i}`)
            .setDescription(`Pick member for exclude, Ex: @user${i}`)
            .setRequired(false),
    )
}

function addDuelRoundOptions(
    command: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    roundCount: number,
    firstMoves: FirstMoveFields,
): void {
    for (let i = 1; i <= roundCount; i++) {
        command.addStringOption((option) =>
            option
                .setName(`map_${i}`)
                .setDescription(`Map name for round ${i}`)
                .setRequired(i === 1)
                .setAutocomplete(true),
        )
        if (firstMoves === "per-round") {
            command.addUserOption((option) =>
                option
                    .setName(`round_${i}_first`)
                    .setDescription(`Who moved first in round ${i}`)
                    .setRequired(i === 1),
            )
        }
        command.addUserOption((option) =>
            option
                .setName(`round_${i}_winner`)
                .setDescription(`Winner of round ${i}`)
                .setRequired(false),
        )
        command.addStringOption((option) =>
            option
                .setName(`p1_hero_${i}`)
                .setDescription(`Player 1 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
        command.addStringOption((option) =>
            option
                .setName(`p2_hero_${i}`)
                .setDescription(`Player 2 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
    }

    if (firstMoves === "ordered") {
        command.addStringOption((option) =>
            option
                .setName("first_moves")
                .setDescription(
                    "Who moved first each round, in order: p1 or p2. Example: p1, p2, p1",
                )
                .setRequired(false),
        )
    }
}

function addTeamRoundOptions(
    command: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    roundCount: number,
): void {
    for (let i = 1; i <= roundCount; i++) {
        command.addStringOption((option) =>
            option
                .setName(`map_${i}`)
                .setDescription(`Map name for round ${i}`)
                .setRequired(i === 1)
                .setAutocomplete(true),
        )
        command.addUserOption((option) =>
            option
                .setName(`round_${i}_winner`)
                .setDescription(`Winner of round ${i}`)
                .setRequired(false),
        )
        command.addStringOption((option) =>
            option
                .setName(`t1p1_hero_${i}`)
                .setDescription(`Team 1 player 1 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
        command.addStringOption((option) =>
            option
                .setName(`t1p2_hero_${i}`)
                .setDescription(`Team 1 player 2 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
        command.addStringOption((option) =>
            option
                .setName(`t2p1_hero_${i}`)
                .setDescription(`Team 2 player 1 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
        command.addStringOption((option) =>
            option
                .setName(`t2p2_hero_${i}`)
                .setDescription(`Team 2 player 2 hero for round ${i}`)
                .setRequired(false)
                .setAutocomplete(true),
        )
    }
}

function buildFixedRegistrationCommands(): SlashCommandBuilder[] {
    return fixedRegistrationCommands().map((spec) => {
        const roundCount = seriesRoundCount(spec.seriesLength)
        const playerOneMovesFirst = spec.seriesLength === SeriesLength.Bo1
        const command = new SlashCommandBuilder()
            .setName(spec.name)
            .setDescription(
                playerOneMovesFirst
                    ? formatTeamSize(spec.format) === 2
                        ? "Register a 2x2 Bo1 rating match. Team 1 player 1 moves first."
                        : "Register a 1x1 Bo1 rating match. Player 1 moves first."
                    : `Register a ${spec.format} ${spec.seriesLength} rating match`,
            )

        if (formatTeamSize(spec.format) === 2) {
            command
                .addUserOption((option) =>
                    option
                        .setName("team1_p1")
                        .setDescription("Team 1 player 1 (moves first)")
                        .setRequired(true),
                )
                .addUserOption((option) =>
                    option
                        .setName("team1_p2")
                        .setDescription("Team 1 player 2")
                        .setRequired(true),
                )
                .addUserOption((option) =>
                    option
                        .setName("team2_p1")
                        .setDescription("Team 2 player 1")
                        .setRequired(true),
                )
                .addUserOption((option) =>
                    option
                        .setName("team2_p2")
                        .setDescription("Team 2 player 2")
                        .setRequired(true),
                )
            addTeamRoundOptions(command, roundCount)
            return command
        }

        const firstMoves: FirstMoveFields = playerOneMovesFirst
            ? "none"
            : duelUsesPerRoundFirstPlayer(roundCount, 2)
              ? "per-round"
              : "ordered"

        command
            .addUserOption((option) =>
                option
                    .setName("player_1")
                    .setDescription(
                        playerOneMovesFirst
                            ? "Player 1 (moves first)"
                            : "First player",
                    )
                    .setRequired(true),
            )
            .addUserOption((option) =>
                option
                    .setName("player_2")
                    .setDescription("Second player")
                    .setRequired(true),
            )
        addDuelRoundOptions(command, roundCount, firstMoves)
        return command
    })
}

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with pong!"),
    new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Get random number")
        .addNumberOption((option) =>
            option
                .setName("capacity")
                .setDescription("Overwrite the capacity to random range")
                .setRequired(false),
        ),
    rollsCmd,
    rollChannelCmd,
    new SlashCommandBuilder()
        .setName("exchange-emoji-to-role")
        .setDescription(
            "Create a message to allow users exchanges emoji to roles",
        )
        .addRoleOption((option) =>
            option
                .setName("role")
                .setDescription("Role to give")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("emoji").setDescription("Emoji").setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("message-id")
                .setDescription("Message ID")
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("remove-all-roles")
                .setDescription("Remove all roles when user unemoji a message"),
        ),
    new SlashCommandBuilder()
        .setName("cancel-exchange-emoji-to-role")
        .setDescription("Cancel exchanges emoji to roles message interaction")
        .addStringOption((option) =>
            option
                .setName("message-id")
                .setDescription("Message ID")
                .setRequired(true),
        ),
    (() => {
        const newRatingMatchCmd = new SlashCommandBuilder()
            .setName("new-rating-match")
            .setDescription(
                "Register a 1x1 series. Bo1: player 1 always moves first.",
            )
            .addStringOption((option) =>
                option
                    .setName("format")
                    .setDescription("Match format")
                    .setRequired(true)
                    .addChoices(
                        universalMatchFormats().map((format) => ({
                            name: format,
                            value: format,
                        })),
                    ),
            )
            .addStringOption((option) =>
                option
                    .setName("series")
                    .setDescription("Series length")
                    .setRequired(true)
                    .addChoices(
                        universalMatchSeries().map((seriesLength) => ({
                            name: seriesLength,
                            value: seriesLength,
                        })),
                    ),
            )
            .addUserOption((option) =>
                option
                    .setName("player_1")
                    .setDescription("First player")
                    .setRequired(true),
            )
            .addUserOption((option) =>
                option
                    .setName("player_2")
                    .setDescription("Second player")
                    .setRequired(true),
            )

        const universalRoundCount = Math.max(
            ...universalMatchSeries().map((seriesLength) =>
                seriesRoundCount(seriesLength),
            ),
        )

        const firstMoves: FirstMoveFields = duelUsesPerRoundFirstPlayer(
            universalRoundCount,
            4,
        )
            ? "per-round"
            : "ordered"

        addDuelRoundOptions(newRatingMatchCmd, universalRoundCount, firstMoves)

        return newRatingMatchCmd
    })(),
    new SlashCommandBuilder()
        .setName("um-1x1")
        .setDescription(
            "Register a LosEnduranceAutumn2026 rating match. p1 moves first.",
        )
        .addUserOption((option) =>
            option
                .setName("p1")
                .setDescription("First player (moves first)")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("p2")
                .setDescription("Second player")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("winner")
                .setDescription("Match winner")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("map")
                .setDescription("Map name")
                .setRequired(true)
                .setAutocomplete(true),
        ),
    ...buildFixedRegistrationCommands(),
    (() => {
        const setupFormats = new SlashCommandBuilder()
            .setName("leaderboard-setup-formats")
            .setDescription("Configure favorite match formats for main rating")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        for (const format of MATCH_FORMATS) {
            setupFormats.addBooleanOption((option) =>
                option
                    .setName(format.toLowerCase())
                    .setDescription(`Include ${format} in favorite formats`)
                    .setRequired(false),
            )
        }

        return setupFormats
    })(),
    new SlashCommandBuilder()
        .setName("leaderboard-setup-special-roles")
        .setDescription("Configure calibration and freeze roles")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption((option) =>
            option
                .setName("calibration_role")
                .setDescription("Calibration role")
                .setRequired(true),
        )
        .addRoleOption((option) =>
            option
                .setName("freeze_role")
                .setDescription("Freeze role")
                .setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard-setup-roles")
        .setDescription("Map a rating tier to a Discord role")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((option) =>
            option
                .setName("tier")
                .setDescription("Tier name")
                .setRequired(true)
                .addChoices(
                    DEFAULT_TIER_DEFINITIONS.map((tier) => ({
                        name: tier.name,
                        value: tier.name,
                    })),
                ),
        )
        .addRoleOption((option) =>
            option
                .setName("role")
                .setDescription("Discord role")
                .setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Show player rating summary")
        .addUserOption((option) =>
            option
                .setName("player")
                .setDescription("Player to inspect")
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard-top")
        .setDescription("Show top players by main rating")
        .addIntegerOption((option) =>
            option
                .setName("size")
                .setDescription("Number of players to show")
                .setRequired(false)
                .addChoices(
                    LEADERBOARD_TOP_SIZES.map((size) => ({
                        name: String(size),
                        value: size,
                    })),
                ),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard-welcome")
        .setDescription("How to set up and use the rating system"),
    new SlashCommandBuilder()
        .setName("leaderboard-config")
        .setDescription("Show current guild leaderboard settings"),
    new SlashCommandBuilder()
        .setName("leaderboard-reset-rating")
        .setDescription("Reset or set a player's rating across all formats")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption((option) =>
            option
                .setName("player")
                .setDescription("Player to update")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("rating")
                .setDescription(
                    "Target rating for all formats (default: guild initial rating)",
                )
                .setRequired(false)
                .setMinValue(0),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard-reset-stats")
        .setDescription("Reset a player's match statistics and freeze status")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption((option) =>
            option
                .setName("player")
                .setDescription("Player to reset")
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("reset_calibration")
                .setDescription(
                    "Also reset per-format calibration history (K2 returns to 3)",
                )
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName("leaderboard-reset-cache")
        .setDescription("Reload the cached maps and heroes lists")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName("leaderboard-freeze-player")
        .setDescription(
            "Force-freeze a player: freeze role, re-calibration, rating preserved",
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption((option) =>
            option
                .setName("player")
                .setDescription("Player to freeze")
                .setRequired(true),
        ),
].map((command) => command.toJSON())

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN)

rest.put(Routes.applicationCommands(discordAppId), { body: commands })
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error)
