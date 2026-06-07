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

export interface RoleSyncPlan {
    removeRoleIds: string[]
    addRoleId: string | null
}

export interface PlayerRoleState {
    isFrozen: boolean
    totalVerifiedMatches: number
    mainRating: number
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

export const DEFAULT_TIER_DEFINITIONS = [
    { name: "Ангел", minRating: 700, maxRating: 750 },
    { name: "Баффи", minRating: 750, maxRating: 800 },
    { name: "Плащ", minRating: 800, maxRating: 850 },
    { name: "Кинжал", minRating: 850, maxRating: 900 },
    { name: "Дэдпул", minRating: 900, maxRating: 950 },
    { name: "Человек-паук", minRating: 950, maxRating: 1000 },
    { name: "Тесла", minRating: 1000, maxRating: 1050 },
    { name: "Ахиллес", minRating: 1050, maxRating: 1100 },
    { name: "Бигфут", minRating: 1100, maxRating: 1150 },
    { name: "Крылан", minRating: 1150, maxRating: 1250 },
    { name: "Джинн", minRating: 1250, maxRating: 1300 },
    { name: "Гудини", minRating: 1300, maxRating: null },
] as const
