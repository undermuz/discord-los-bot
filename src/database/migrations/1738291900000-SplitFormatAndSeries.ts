import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

function roundToRating(value: number): number {
    return Math.round(value * 100) / 100
}

const LEGACY_SERIES_FORMATS = ["Bo1", "Bo2", "Bo3", "Bo5"]

export class SplitFormatAndSeries1738291900000 implements MigrationInterface {
    name = "SplitFormatAndSeries1738291900000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "rating_matches",
            new TableColumn({
                name: "seriesLength",
                type: "varchar",
                default: "'Bo1'",
            }),
        )
        await queryRunner.addColumn(
            "rating_matches",
            new TableColumn({
                name: "winnerPartnerUserId",
                type: "varchar",
                isNullable: true,
            }),
        )
        await queryRunner.addColumn(
            "rating_matches",
            new TableColumn({
                name: "loserPartnerUserId",
                type: "varchar",
                isNullable: true,
            }),
        )
        await queryRunner.addColumn(
            "rating_match_rounds",
            new TableColumn({
                name: "playerOnePartnerHeroName",
                type: "varchar",
                isNullable: true,
            }),
        )
        await queryRunner.addColumn(
            "rating_match_rounds",
            new TableColumn({
                name: "playerTwoPartnerHeroName",
                type: "varchar",
                isNullable: true,
            }),
        )

        const legacyList = LEGACY_SERIES_FORMATS.map(
            (format) => `'${format}'`,
        ).join(", ")

        await queryRunner.query(`
            UPDATE rating_matches
            SET seriesLength = format
            WHERE format IN (${legacyList})
        `)
        await queryRunner.query(`
            UPDATE rating_matches
            SET format = '1x1'
            WHERE format IN (${legacyList})
        `)

        await this.mergeLegacyRatings(queryRunner)
        await this.rewriteFavoriteFormats(queryRunner)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(
            "rating_match_rounds",
            "playerTwoPartnerHeroName",
        )
        await queryRunner.dropColumn(
            "rating_match_rounds",
            "playerOnePartnerHeroName",
        )
        await queryRunner.dropColumn("rating_matches", "loserPartnerUserId")
        await queryRunner.dropColumn("rating_matches", "winnerPartnerUserId")
        await queryRunner.dropColumn("rating_matches", "seriesLength")
    }

    private async mergeLegacyRatings(queryRunner: QueryRunner): Promise<void> {
        const legacyList = LEGACY_SERIES_FORMATS.map(
            (format) => `'${format}'`,
        ).join(", ")
        const groups = (await queryRunner.query(`
            SELECT guildId,
                   discordUserId,
                   AVG(rating) AS rating,
                   SUM(verifiedMatchCount) AS verifiedMatchCount,
                   MAX(lastPlayedAt) AS lastPlayedAt,
                   MAX(calibrationCompleted) AS calibrationCompleted
            FROM player_ratings
            WHERE format IN (${legacyList})
            GROUP BY guildId, discordUserId
        `)) as Array<{
            guildId: string
            discordUserId: string
            rating: number
            verifiedMatchCount: number
            lastPlayedAt: string | null
            calibrationCompleted: number
        }>

        for (const group of groups) {
            await queryRunner.query(
                `INSERT INTO player_ratings (
                    guildId,
                    discordUserId,
                    format,
                    rating,
                    verifiedMatchCount,
                    lastPlayedAt,
                    calibrationCompleted
                ) VALUES (?, ?, '1x1', ?, ?, ?, ?)`,
                [
                    group.guildId,
                    group.discordUserId,
                    roundToRating(Number(group.rating)),
                    Number(group.verifiedMatchCount),
                    group.lastPlayedAt,
                    group.calibrationCompleted ? 1 : 0,
                ],
            )
        }

        await queryRunner.query(
            `DELETE FROM player_ratings WHERE format IN (${legacyList})`,
        )
    }

    private async rewriteFavoriteFormats(
        queryRunner: QueryRunner,
    ): Promise<void> {
        const configs = (await queryRunner.query(
            `SELECT guildId, favoriteFormats FROM leaderboard_guild_config`,
        )) as Array<{ guildId: string; favoriteFormats: string }>
        const legacy = new Set(LEGACY_SERIES_FORMATS)

        for (const config of configs) {
            const formats = JSON.parse(config.favoriteFormats) as string[]
            const next: string[] = []

            for (const format of formats) {
                const mapped = legacy.has(format) ? "1x1" : format

                if (!next.includes(mapped)) {
                    next.push(mapped)
                }
            }

            await queryRunner.query(
                `UPDATE leaderboard_guild_config
                 SET favoriteFormats = ?
                 WHERE guildId = ?`,
                [JSON.stringify(next), config.guildId],
            )
        }
    }
}
