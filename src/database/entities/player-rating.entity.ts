import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("player_ratings")
@Unique(["guildId", "discordUserId", "format"])
export class PlayerRating {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    discordUserId: string

    @Column()
    format: string

    @Column({ type: "real", default: 1000 })
    rating: number

    @Column({ default: 0 })
    verifiedMatchCount: number

    @Column({ type: "datetime", nullable: true })
    lastPlayedAt: Date | null
}

@Entity("player_states")
@Unique(["guildId", "discordUserId"])
export class PlayerState {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    discordUserId: string

    @Column({ default: false })
    isFrozen: boolean
}
