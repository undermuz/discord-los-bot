import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

const CALIBRATION_MATCH_THRESHOLD = 4
const INACTIVITY_DAYS = 90
const PREVIOUS_CALIBRATION_MATCH_THRESHOLD = 10
const PREVIOUS_INACTIVITY_DAYS = 60

export class UpdateCalibrationAndFreeze1738291700000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE leaderboard_guild_config
             SET calibrationMatchThreshold = ?,
                 inactivityDays = ?`,
            [CALIBRATION_MATCH_THRESHOLD, INACTIVITY_DAYS],
        )

        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "calibrationMatchThreshold",
            new TableColumn({
                name: "calibrationMatchThreshold",
                type: "integer",
                default: CALIBRATION_MATCH_THRESHOLD,
            }),
        )
        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "inactivityDays",
            new TableColumn({
                name: "inactivityDays",
                type: "integer",
                default: INACTIVITY_DAYS,
            }),
        )

        const guilds = (await queryRunner.query(
            `SELECT guildId, calibrationMatchThreshold FROM leaderboard_guild_config`,
        )) as Array<{
            guildId: string
            calibrationMatchThreshold: number
        }>

        for (const config of guilds) {
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
        await queryRunner.query(
            `UPDATE player_ratings
             SET calibrationCompleted = 0
             WHERE verifiedMatchCount < ?`,
            [PREVIOUS_CALIBRATION_MATCH_THRESHOLD],
        )

        await queryRunner.query(
            `UPDATE leaderboard_guild_config
             SET calibrationMatchThreshold = ?,
                 inactivityDays = ?`,
            [PREVIOUS_CALIBRATION_MATCH_THRESHOLD, PREVIOUS_INACTIVITY_DAYS],
        )

        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "calibrationMatchThreshold",
            new TableColumn({
                name: "calibrationMatchThreshold",
                type: "integer",
                default: PREVIOUS_CALIBRATION_MATCH_THRESHOLD,
            }),
        )
        await queryRunner.changeColumn(
            "leaderboard_guild_config",
            "inactivityDays",
            new TableColumn({
                name: "inactivityDays",
                type: "integer",
                default: PREVIOUS_INACTIVITY_DAYS,
            }),
        )
    }
}
