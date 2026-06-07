import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class ChangeRatingPrecision1738291300000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(
            "player_ratings",
            "rating",
            new TableColumn({
                name: "rating",
                type: "real",
                default: 1000,
            }),
        )

        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "initialRating",
            new TableColumn({
                name: "initialRating",
                type: "real",
                default: 1000,
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(
            "player_ratings",
            "rating",
            new TableColumn({
                name: "rating",
                type: "integer",
                default: 1000,
            }),
        )

        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "initialRating",
            new TableColumn({
                name: "initialRating",
                type: "integer",
                default: 1000,
            }),
        )
    }
}
