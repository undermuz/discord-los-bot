import { MigrationInterface, QueryRunner } from "typeorm"
import { DEFAULT_TIER_DEFINITIONS } from "../../modules/leaderboard/types.js"

const PREVIOUS_TIER_DEFINITIONS = [
    { name: "Ангел", minRating: 700, maxRating: 750 },
    { name: "Баффи", minRating: 750, maxRating: 800 },
    { name: "Плащ", minRating: 800, maxRating: 850 },
    { name: "Кинжал", minRating: 850, maxRating: 900 },
    { name: "Дэдпул", minRating: 900, maxRating: 950 },
    { name: "Человек-паук", minRating: 950, maxRating: 1000 },
    { name: "Тесла", minRating: 1000, maxRating: 1050 },
    { name: "Ахиллес", minRating: 1050, maxRating: 1100 },
    { name: "Бигфут", minRating: 1100, maxRating: 1150 },
    { name: "Крылан", minRating: 1150, maxRating: 1250 },
    { name: "Джинн", minRating: 1250, maxRating: 1300 },
    { name: "Гудини", minRating: 1300, maxRating: null },
] as const

export class ReplaceRatingTiers1738291500000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const guilds = (await queryRunner.query(
            `SELECT guildId FROM leaderboard_guild_config`,
        )) as Array<{ guildId: string }>

        await queryRunner.query(`DELETE FROM rating_tier_roles`)

        for (const guild of guilds) {
            for (const tier of DEFAULT_TIER_DEFINITIONS) {
                await queryRunner.query(
                    `INSERT INTO rating_tier_roles (guildId, name, minRating, maxRating, roleId)
                     VALUES (?, ?, ?, ?, NULL)`,
                    [guild.guildId, tier.name, tier.minRating, tier.maxRating],
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const guilds = (await queryRunner.query(
            `SELECT guildId FROM leaderboard_guild_config`,
        )) as Array<{ guildId: string }>

        await queryRunner.query(`DELETE FROM rating_tier_roles`)

        for (const guild of guilds) {
            for (const tier of PREVIOUS_TIER_DEFINITIONS) {
                await queryRunner.query(
                    `INSERT INTO rating_tier_roles (guildId, name, minRating, maxRating, roleId)
                     VALUES (?, ?, ?, ?, NULL)`,
                    [guild.guildId, tier.name, tier.minRating, tier.maxRating],
                )
            }
        }
    }
}
