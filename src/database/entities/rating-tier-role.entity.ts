import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("rating_tier_roles")
@Unique(["guildId", "name"])
export class RatingTierRole {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    name: string

    @Column()
    minRating: number

    @Column({ type: "integer", nullable: true })
    maxRating: number | null

    @Column({ type: "varchar", nullable: true })
    roleId: string | null
}
