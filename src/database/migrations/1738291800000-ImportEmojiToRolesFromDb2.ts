import { MigrationInterface, QueryRunner } from "typeorm"

/** Rules from db2.json. The source file repeats one rule; the existence check drops it. */
const EMOJI_TO_ROLE_RULES = [
    {
        guildId: "753616491961909322",
        roleId: "1104804548587049141",
        emoji: "👍🏻",
        messageId: "1104804666392465448",
        removeAllRoles: false,
    },
    {
        guildId: "194280069256970241",
        roleId: "194280869270126592",
        emoji: "👍",
        messageId: "1104837259007639664",
        removeAllRoles: false,
    },
    {
        guildId: "194280069256970241",
        roleId: "194280869270126592",
        emoji: "👍",
        messageId: "1104837235485982771",
        removeAllRoles: false,
    },
    {
        guildId: "1104869941259276288",
        roleId: "1104870142556508291",
        emoji: "👍",
        messageId: "1104870219341648074",
        removeAllRoles: false,
    },
    {
        guildId: "194280069256970241",
        roleId: "1105036280544374825",
        emoji: "👍",
        messageId: "1105068573698834493",
        removeAllRoles: false,
    },
    {
        guildId: "194280069256970241",
        roleId: "1105036280544374825",
        emoji: "👍",
        messageId: "1105071501515952138",
        removeAllRoles: false,
    },
    {
        guildId: "1154827941809770616",
        roleId: "1154836666792562720",
        emoji: "👍",
        messageId: "1154870584493228052",
        removeAllRoles: false,
    },
    {
        guildId: "753616491961909322",
        roleId: "1104804548587049141",
        emoji: "✅",
        messageId: "1250410604750045234",
        removeAllRoles: true,
    },
    {
        guildId: "1154827941809770616",
        roleId: "1154836666792562720",
        emoji: "👍",
        messageId: "1156137370345799690",
        removeAllRoles: true,
    },
] as const

export class ImportEmojiToRolesFromDb21738291800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const rule of EMOJI_TO_ROLE_RULES) {
            const existing = (await queryRunner.query(
                `SELECT id FROM emoji_to_roles
                 WHERE guildId = ? AND roleId = ? AND emoji = ? AND messageId = ?
                 LIMIT 1`,
                [rule.guildId, rule.roleId, rule.emoji, rule.messageId],
            )) as Array<{ id: number }>

            if (existing.length > 0) {
                continue
            }

            await queryRunner.query(
                `INSERT INTO emoji_to_roles (guildId, roleId, emoji, messageId, removeAllRoles)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    rule.guildId,
                    rule.roleId,
                    rule.emoji,
                    rule.messageId,
                    rule.removeAllRoles ? 1 : 0,
                ],
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const rule of EMOJI_TO_ROLE_RULES) {
            await queryRunner.query(
                `DELETE FROM emoji_to_roles
                 WHERE guildId = ? AND roleId = ? AND emoji = ? AND messageId = ?`,
                [rule.guildId, rule.roleId, rule.emoji, rule.messageId],
            )
        }
    }
}
