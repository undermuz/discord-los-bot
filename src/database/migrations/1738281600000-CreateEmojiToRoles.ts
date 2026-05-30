import { MigrationInterface, QueryRunner, Table } from "typeorm"

export class CreateEmojiToRoles1738281600000 implements MigrationInterface {
    name = "CreateEmojiToRoles1738281600000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "emoji_to_roles",
                columns: [
                    {
                        name: "id",
                        type: "integer",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    { name: "guildId", type: "varchar" },
                    { name: "roleId", type: "varchar" },
                    { name: "emoji", type: "varchar" },
                    { name: "messageId", type: "varchar" },
                    {
                        name: "removeAllRoles",
                        type: "boolean",
                        default: false,
                    },
                ],
                uniques: [
                    {
                        name: "UQ_emoji_to_roles_rule",
                        columnNames: [
                            "guildId",
                            "roleId",
                            "emoji",
                            "messageId",
                        ],
                    },
                ],
            }),
            true,
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("emoji_to_roles")
    }
}
