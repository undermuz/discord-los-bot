import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("emoji_to_roles")
@Unique(["guildId", "roleId", "emoji", "messageId"])
export class EmojiToRole {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    roleId: string

    @Column()
    emoji: string

    @Column()
    messageId: string

    @Column({ default: false })
    removeAllRoles: boolean
}
