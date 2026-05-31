import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableColumn,
    TableUnique,
} from "typeorm"

export class AddRatingMatchRounds1738291000000 implements MigrationInterface {
    name = "AddRatingMatchRounds1738291000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("rating_matches", [
            new TableColumn({
                name: "winnerScore",
                type: "integer",
                default: 0,
            }),
            new TableColumn({
                name: "loserScore",
                type: "integer",
                default: 0,
            }),
        ])

        await queryRunner.createTable(
            new Table({
                name: "rating_match_rounds",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "matchId", type: "integer" },
                    { name: "roundNumber", type: "integer" },
                    { name: "winnerUserId", type: "varchar" },
                    { name: "loserUserId", type: "varchar" },
                    { name: "mapName", type: "varchar" },
                ],
            }),
            true,
        )

        await queryRunner.createUniqueConstraint(
            "rating_match_rounds",
            new TableUnique({
                name: "UQ_rating_match_rounds_match_round",
                columnNames: ["matchId", "roundNumber"],
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("rating_match_rounds")
        await queryRunner.dropColumn("rating_matches", "loserScore")
        await queryRunner.dropColumn("rating_matches", "winnerScore")
    }
}
