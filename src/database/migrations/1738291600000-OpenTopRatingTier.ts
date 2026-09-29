import { MigrationInterface, QueryRunner } from "typeorm"

const OPEN_TIER_MIN_RATING = 2000
const PREVIOUS_TIER_STEP = 100
const PREVIOUS_LAST_MIN_RATING = 2400

const PREVIOUS_TOP_TIERS = Array.from(
    {
        length:
            (PREVIOUS_LAST_MIN_RATING - OPEN_TIER_MIN_RATING) /
                PREVIOUS_TIER_STEP +
            1,
    },
    (_, index) => {
        const minRating = OPEN_TIER_MIN_RATING + index * PREVIOUS_TIER_STEP
        const maxRating = minRating + PREVIOUS_TIER_STEP

        return {
            name: `${minRating}-${maxRating - 1}`,
            minRating,
            maxRating,
        }
    },
)

export class OpenTopRatingTier1738291600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const guilds = (await queryRunner.query(
            `SELECT guildId FROM leaderboard_guild_config`,
        )) as Array<{ guildId: string }>

        await queryRunner.query(
            `DELETE FROM rating_tier_roles WHERE minRating >= ?`,
            [OPEN_TIER_MIN_RATING],
        )

        for (const guild of guilds) {
            await queryRunner.query(
                `INSERT INTO rating_tier_roles (guildId, name, minRating, maxRating, roleId)
                 VALUES (?, ?, ?, NULL, NULL)`,
                [
                    guild.guildId,
                    `${OPEN_TIER_MIN_RATING}+`,
                    OPEN_TIER_MIN_RATING,
                ],
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const guilds = (await queryRunner.query(
            `SELECT guildId FROM leaderboard_guild_config`,
        )) as Array<{ guildId: string }>

        await queryRunner.query(
            `DELETE FROM rating_tier_roles WHERE minRating >= ?`,
            [OPEN_TIER_MIN_RATING],
        )

        for (const guild of guilds) {
            for (const tier of PREVIOUS_TOP_TIERS) {
                await queryRunner.query(
                    `INSERT INTO rating_tier_roles (guildId, name, minRating, maxRating, roleId)
                     VALUES (?, ?, ?, ?, NULL)`,
                    [guild.guildId, tier.name, tier.minRating, tier.maxRating],
                )
            }
        }
    }
}
