import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddRoundHeroesAndFirstPlayer1738291200000 implements MigrationInterface {
    name = "AddRoundHeroesAndFirstPlayer1738291200000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("rating_match_rounds", [
            new TableColumn({
                name: "playerOneHeroName",
                type: "varchar",
                default: "''",
            }),
            new TableColumn({
                name: "playerTwoHeroName",
                type: "varchar",
                default: "''",
            }),
            new TableColumn({
                name: "firstPlayerUserId",
                type: "varchar",
                default: "''",
            }),
        ])

        await queryRunner.query(`
            UPDATE rating_match_rounds
            SET firstPlayerUserId = winnerUserId
            WHERE firstPlayerUserId = ''
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("rating_match_rounds", "firstPlayerUserId")
        await queryRunner.dropColumn("rating_match_rounds", "playerTwoHeroName")
        await queryRunner.dropColumn("rating_match_rounds", "playerOneHeroName")
    }
}
