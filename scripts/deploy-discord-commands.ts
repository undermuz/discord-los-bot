import "dotenv/config"
import {
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
} from "discord.js"
import {
    DEFAULT_TIER_DEFINITIONS,
    LEADERBOARD_TOP_SIZES,
    MATCH_FORMATS,
} from "../src/modules/leaderboard/types"

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
            .setDescription("Register a new 1v1 rating match series")
            .addStringOption((option) =>
                option
                    .setName("format")
                    .setDescription("Match format")
                    .setRequired(true)
                    .addChoices(
                        MATCH_FORMATS.map((format) => ({
                            name: format,
                            value: format,
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

        for (let i = 1; i <= 5; i++) {
            newRatingMatchCmd.addStringOption((option) =>
                option
                    .setName(`map_${i}`)
                    .setDescription(`Map name for round ${i}`)
                    .setRequired(i === 1)
                    .setAutocomplete(true),
            )
            newRatingMatchCmd.addUserOption((option) =>
                option
                    .setName(`round_${i}_winner`)
                    .setDescription(`Winner of round ${i}`)
                    .setRequired(false),
            )
            newRatingMatchCmd.addStringOption((option) =>
                option
                    .setName(`p1_hero_${i}`)
                    .setDescription(`Player 1 hero for round ${i}`)
                    .setRequired(false)
                    .setAutocomplete(true),
            )
            newRatingMatchCmd.addStringOption((option) =>
                option
                    .setName(`p2_hero_${i}`)
                    .setDescription(`Player 2 hero for round ${i}`)
                    .setRequired(false)
                    .setAutocomplete(true),
            )
        }

        newRatingMatchCmd.addStringOption((option) =>
            option
                .setName("p1_first_rounds")
                .setDescription(
                    "Rounds where player 1 moved first (e.g. 1,3). Others: player 2",
                )
                .setRequired(false),
        )

        return newRatingMatchCmd
    })(),
    new SlashCommandBuilder()
        .setName("um-1x1")
        .setDescription("Register a Bo1 rating match")
        .addUserOption((option) =>
            option
                .setName("p1")
                .setDescription("First player")
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
        )
        .addStringOption((option) =>
            option
                .setName("p1_hero")
                .setDescription("Player 1 hero")
                .setRequired(true)
                .setAutocomplete(true),
        )
        .addStringOption((option) =>
            option
                .setName("p2_hero")
                .setDescription("Player 2 hero")
                .setRequired(true)
                .setAutocomplete(true),
        ),
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
