export enum MatchFormat {
    Bo1 = "Bo1",
    Bo2 = "Bo2",
    Bo3 = "Bo3",
    Bo5 = "Bo5",
}

export enum MatchStatus {
    Pending = "pending",
    Verified = "verified",
    Cancelled = "cancelled",
}

export const MATCH_FORMATS = Object.values(MatchFormat)

export interface RegisterMatchRoundDto {
    roundNumber: number
    winnerUserId: string
    mapName: string
    playerOneHeroName: string
    playerTwoHeroName: string
    firstPlayerUserId: string
}

export interface SeriesScore {
    winnerScore: number
    loserScore: number
}

export interface SeriesResult extends SeriesScore {
    winnerUserId: string
    loserUserId: string
}

export interface RegisterMatchDto {
    guildId: string
    channelId: string
    registeredByUserId: string
    format: MatchFormat
    playerOneUserId: string
    playerTwoUserId: string
    rounds: RegisterMatchRoundDto[]
}

export interface RoleSyncRemoval {
    roleId: string
    reason: string
}

export interface RoleSyncPlan {
    removeRoleIds: RoleSyncRemoval[]
    addRoleId: string | null
    addReason: string | null
    unchangedReason: string | null
}

export interface PlayerRoleState {
    isFrozen: boolean
    totalVerifiedMatches: number
    mainRating: number
}

export interface PlayerFormatRatingSummary {
    format: MatchFormat
    rating: number
    k1: number
    k2: number
}

export interface PlayerLeaderboardSummary {
    state: PlayerRoleState
    formatRatings: PlayerFormatRatingSummary[]
}

export const LEADERBOARD_TOP_SIZES = [10, 50, 100] as const
export type LeaderboardTopSize = (typeof LEADERBOARD_TOP_SIZES)[number]
export const DEFAULT_LEADERBOARD_TOP_SIZE: LeaderboardTopSize = 10

export interface LeaderboardTopEntry {
    discordUserId: string
    mainRating: number
    totalVerifiedMatches: number
    isFrozen: boolean
}

const TIER_STEP = 100
const TIER_MIN_RATING = 0
const OPEN_TIER_MIN_RATING = 2000

const closedTierCount = (OPEN_TIER_MIN_RATING - TIER_MIN_RATING) / TIER_STEP

export const DEFAULT_TIER_DEFINITIONS = [
    ...Array.from({ length: closedTierCount }, (_, index) => {
        const minRating = TIER_MIN_RATING + index * TIER_STEP
        const maxRating = minRating + TIER_STEP

        return {
            name: `${minRating}-${maxRating - 1}`,
            minRating,
            maxRating,
        }
    }),
    {
        name: `${OPEN_TIER_MIN_RATING}+`,
        minRating: OPEN_TIER_MIN_RATING,
        maxRating: null,
    },
]
