import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddCalibrationCompleted1738291400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "player_ratings",
            new TableColumn({
                name: "calibrationCompleted",
                type: "boolean",
                default: false,
            }),
        )

        const guildConfigs = (await queryRunner.query(
            `SELECT guildId, calibrationMatchThreshold FROM leaderboard_guild_config`,
        )) as Array<{
            guildId: string
            calibrationMatchThreshold: number
        }>

        for (const config of guildConfigs) {
            await queryRunner.query(
                `UPDATE player_ratings
                 SET calibrationCompleted = 1
                 WHERE guildId = ?
                   AND verifiedMatchCount >= ?`,
                [config.guildId, config.calibrationMatchThreshold],
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("player_ratings", "calibrationCompleted")
    }
}
