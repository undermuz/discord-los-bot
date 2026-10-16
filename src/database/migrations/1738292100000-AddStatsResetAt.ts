import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddStatsResetAt1738292100000 implements MigrationInterface {
    name = "AddStatsResetAt1738292100000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "player_states",
            new TableColumn({
                name: "statsResetAt",
                type: "datetime",
                isNullable: true,
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("player_states", "statsResetAt")
    }
}
