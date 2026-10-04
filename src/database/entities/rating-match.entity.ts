import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm"
import {
    MatchFormat,
    MatchStatus,
    SeriesLength,
} from "../../modules/leaderboard/types.js"

@Entity("rating_matches")
@Index(["guildId", "messageId"])
export class RatingMatch {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    channelId: string

    @Column({ type: "varchar", nullable: true })
    messageId: string | null

    @Column({ type: "varchar" })
    format: MatchFormat

    @Column({ type: "varchar" })
    seriesLength: SeriesLength

    @Column()
    registeredByUserId: string

    @Column()
    winnerUserId: string

    @Column()
    loserUserId: string

    @Column({ type: "varchar", nullable: true })
    winnerPartnerUserId: string | null

    @Column({ type: "varchar", nullable: true })
    loserPartnerUserId: string | null

    @Column({ default: 0 })
    winnerScore: number

    @Column({ default: 0 })
    loserScore: number

    @Column({ type: "varchar", default: MatchStatus.Pending })
    status: MatchStatus

    @CreateDateColumn()
    createdAt: Date

    @Column({ type: "datetime", nullable: true })
    verifiedAt: Date | null
}

@Entity("match_confirmations")
@Unique(["matchId", "discordUserId"])
export class MatchConfirmation {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    matchId: number

    @Column()
    discordUserId: string

    @Column({ default: false })
    autoConfirmed: boolean

    @CreateDateColumn()
    confirmedAt: Date
}

@Entity("rating_match_rounds")
@Unique(["matchId", "roundNumber"])
export class RatingMatchRound {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    matchId: number

    @Column()
    roundNumber: number

    @Column()
    winnerUserId: string

    @Column()
    loserUserId: string

    @Column()
    mapName: string

    @Column()
    playerOneHeroName: string

    @Column()
    playerTwoHeroName: string

    @Column({ type: "varchar", nullable: true })
    playerOnePartnerHeroName: string | null

    @Column({ type: "varchar", nullable: true })
    playerTwoPartnerHeroName: string | null

    @Column()
    firstPlayerUserId: string
}
