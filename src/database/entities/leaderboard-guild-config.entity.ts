import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("leaderboard_guild_config")
export class LeaderboardGuildConfig {
    @PrimaryColumn()
    guildId: string

    @Column({ type: "simple-json", default: "[]" })
    favoriteFormats: string[]

    @Column({ default: "✅" })
    verifyEmoji: string

    @Column({ type: "varchar", nullable: true })
    calibrationRoleId: string | null

    @Column({ type: "varchar", nullable: true })
    freezeRoleId: string | null

    @Column({ default: 10 })
    calibrationMatchThreshold: number

    @Column({ default: 60 })
    inactivityDays: number

    @Column({ default: 1000 })
    initialRating: number
}
