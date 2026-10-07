import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableColumn,
    TableUnique,
} from "typeorm"

export class AddMatchCancellation1738292000000 implements MigrationInterface {
    name = "AddMatchCancellation1738292000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "leaderboard_guild_config",
            new TableColumn({
                name: "rejectEmoji",
                type: "varchar",
                default: "'❌'",
            }),
        )
        await queryRunner.addColumns("rating_matches", [
            new TableColumn({
                name: "cancelledAt",
                type: "datetime",
                isNullable: true,
            }),
            new TableColumn({
                name: "cancelledByUserId",
                type: "varchar",
                isNullable: true,
            }),
        ])
        await queryRunner.createTable(
            new Table({
                name: "rating_match_player_changes",
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
                    { name: "format", type: "varchar" },
                    { name: "ratingDelta", type: "real" },
                    {
                        name: "calibrationCompletedBefore",
                        type: "boolean",
                        default: false,
                    },
                    {
                        name: "lastPlayedAtBefore",
                        type: "datetime",
                        isNullable: true,
                    },
                ],
            }),
            true,
        )
        await queryRunner.createUniqueConstraint(
            "rating_match_player_changes",
            new TableUnique({
                name: "UQ_rating_match_player_changes_match_user",
                columnNames: ["matchId", "discordUserId"],
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("rating_match_player_changes")
        await queryRunner.dropColumn("rating_matches", "cancelledByUserId")
        await queryRunner.dropColumn("rating_matches", "cancelledAt")
        await queryRunner.dropColumn("leaderboard_guild_config", "rejectEmoji")
    }
}
