import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableUnique,
} from "typeorm"

export class CreateLeaderboard1738290000000 implements MigrationInterface {
    name = "CreateLeaderboard1738290000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "leaderboard_guild_config",
                columns: [
                    { name: "guildId", type: "varchar", isPrimary: true },
                    {
                        name: "favoriteFormats",
                        type: "text",
                        default: "'[]'",
                    },
                    { name: "verifyEmoji", type: "varchar", default: "'✅'" },
                    {
                        name: "calibrationRoleId",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "freezeRoleId",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "calibrationMatchThreshold",
                        type: "integer",
                        default: 10,
                    },
                    { name: "inactivityDays", type: "integer", default: 60 },
                    { name: "initialRating", type: "integer", default: 1000 },
                ],
            }),
            true,
        )

        await queryRunner.createTable(
            new Table({
                name: "rating_tier_roles",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "guildId", type: "varchar" },
                    { name: "name", type: "varchar" },
                    { name: "minRating", type: "integer" },
                    {
                        name: "maxRating",
                        type: "integer",
                        isNullable: true,
                    },
                    { name: "roleId", type: "varchar", isNullable: true },
                ],
            }),
            true,
        )

        await queryRunner.createUniqueConstraint(
            "rating_tier_roles",
            new TableUnique({
                name: "UQ_rating_tier_roles_guild_name",
                columnNames: ["guildId", "name"],
            }),
        )

        await queryRunner.createTable(
            new Table({
                name: "player_ratings",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "guildId", type: "varchar" },
                    { name: "discordUserId", type: "varchar" },
                    { name: "format", type: "varchar" },
                    { name: "rating", type: "integer", default: 1000 },
                    {
                        name: "verifiedMatchCount",
                        type: "integer",
                        default: 0,
                    },
                    {
                        name: "lastPlayedAt",
                        type: "datetime",
                        isNullable: true,
                    },
                ],
            }),
            true,
        )

        await queryRunner.createUniqueConstraint(
            "player_ratings",
            new TableUnique({
                name: "UQ_player_ratings_guild_user_format",
                columnNames: ["guildId", "discordUserId", "format"],
            }),
        )

        await queryRunner.createTable(
            new Table({
                name: "player_states",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "guildId", type: "varchar" },
                    { name: "discordUserId", type: "varchar" },
                    {
                        name: "isFrozen",
                        type: "boolean",
                        default: false,
                    },
                ],
            }),
            true,
        )

        await queryRunner.createUniqueConstraint(
            "player_states",
            new TableUnique({
                name: "UQ_player_states_guild_user",
                columnNames: ["guildId", "discordUserId"],
            }),
        )

        await queryRunner.createTable(
            new Table({
                name: "rating_matches",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "guildId", type: "varchar" },
                    { name: "channelId", type: "varchar" },
                    {
                        name: "messageId",
                        type: "varchar",
                        isNullable: true,
                    },
                    { name: "format", type: "varchar" },
                    { name: "registeredByUserId", type: "varchar" },
                    { name: "winnerUserId", type: "varchar" },
                    { name: "loserUserId", type: "varchar" },
                    {
                        name: "status",
                        type: "varchar",
                        default: "'pending'",
                    },
                    {
                        name: "createdAt",
                        type: "datetime",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "verifiedAt",
                        type: "datetime",
                        isNullable: true,
                    },
                ],
            }),
            true,
        )

        await queryRunner.createIndex(
            "rating_matches",
            new TableIndex({
                name: "IDX_rating_matches_guild_message",
                columnNames: ["guildId", "messageId"],
            }),
        )

        await queryRunner.createTable(
            new Table({
                name: "match_confirmations",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "matchId", type: "integer" },
                    { name: "discordUserId", type: "varchar" },
                    {
                        name: "autoConfirmed",
                        type: "boolean",
                        default: false,
                    },
                    {
                        name: "confirmedAt",
                        type: "datetime",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        )

        await queryRunner.createUniqueConstraint(
            "match_confirmations",
            new TableUnique({
                name: "UQ_match_confirmations_match_user",
                columnNames: ["matchId", "discordUserId"],
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("match_confirmations")
        await queryRunner.dropTable("rating_matches")
        await queryRunner.dropTable("player_states")
        await queryRunner.dropTable("player_ratings")
        await queryRunner.dropTable("rating_tier_roles")
        await queryRunner.dropTable("leaderboard_guild_config")
    }
}
