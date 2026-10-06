export enum MatchFormat {
    OneVsOne = "1x1",
    TwoVsTwo = "2x2",
    LosEnduranceAutumn2026 = "LosEnduranceAutumn2026",
}

export enum SeriesLength {
    Bo1 = "Bo1",
    Bo2 = "Bo2",
    Bo3 = "Bo3",
    Bo5 = "Bo5",
}

export function formatRequiresHeroes(format: MatchFormat): boolean {
    return format !== MatchFormat.LosEnduranceAutumn2026
}

export function formatTeamSize(format: MatchFormat): number {
    return format === MatchFormat.TwoVsTwo ? 2 : 1
}

export enum MatchStatus {
    Pending = "pending",
    Verified = "verified",
    Cancelled = "cancelled",
}

export const MATCH_FORMATS = Object.values(MatchFormat)
export const SERIES_LENGTHS = Object.values(SeriesLength)
export const DUEL_MATCH_FORMATS = [
    MatchFormat.OneVsOne,
    MatchFormat.LosEnduranceAutumn2026,
]
export const FORMAT_SERIES: Record<MatchFormat, readonly SeriesLength[]> = {
    [MatchFormat.OneVsOne]: [
        SeriesLength.Bo1,
        SeriesLength.Bo2,
        SeriesLength.Bo3,
        SeriesLength.Bo5,
    ],
    [MatchFormat.TwoVsTwo]: [SeriesLength.Bo1],
    [MatchFormat.LosEnduranceAutumn2026]: [SeriesLength.Bo1],
}
export const UNIQ_FORMATS: readonly MatchFormat[] = [
    MatchFormat.LosEnduranceAutumn2026,
]

export function isUniqueFormat(format: MatchFormat): boolean {
    return UNIQ_FORMATS.includes(format)
}

export function universalMatchFormats(): MatchFormat[] {
    return DUEL_MATCH_FORMATS.filter((format) => !isUniqueFormat(format))
}

export function universalMatchSeries(): SeriesLength[] {
    const series = new Set<SeriesLength>()

    for (const format of universalMatchFormats()) {
        for (const seriesLength of FORMAT_SERIES[format]) {
            series.add(seriesLength)
        }
    }

    return [...series]
}

export function isFormatSeriesAllowed(
    format: MatchFormat,
    seriesLength: SeriesLength,
): boolean {
    return FORMAT_SERIES[format].includes(seriesLength)
}

export interface FixedRegistrationCommand {
    name: string
    format: MatchFormat
    seriesLength: SeriesLength
}

export function fixedRegistrationCommands(): FixedRegistrationCommand[] {
    const commands: FixedRegistrationCommand[] = []

    for (const format of MATCH_FORMATS) {
        if (isUniqueFormat(format)) {
            continue
        }

        const series = FORMAT_SERIES[format]
        const [onlySeries] = series

        if (series.length === 1 && onlySeries) {
            commands.push({
                name: `um-${format}`,
                format,
                seriesLength: onlySeries,
            })
            continue
        }

        for (const seriesLength of series) {
            commands.push({
                name: `um-${format}-${seriesLength.toLowerCase()}`,
                format,
                seriesLength,
            })
        }
    }

    return commands
}

export function seriesRoundCount(seriesLength: SeriesLength): number {
    switch (seriesLength) {
        case SeriesLength.Bo1:
            return 1
        case SeriesLength.Bo2:
            return 2
        case SeriesLength.Bo3:
            return 3
        case SeriesLength.Bo5:
            return 5
    }
}

const SLASH_OPTION_LIMIT = 25
const DUEL_OPTIONS_PER_ROUND_WITH_FIRST_PLAYER = 5

export function duelUsesPerRoundFirstPlayer(
    roundCount: number,
    leadingOptions: number,
): boolean {
    return (
        leadingOptions +
            roundCount * DUEL_OPTIONS_PER_ROUND_WITH_FIRST_PLAYER <=
        SLASH_OPTION_LIMIT
    )
}

export interface RegisterMatchRoundDto {
    roundNumber: number
    winnerUserId: string
    mapName: string
    playerOneHeroName: string
    playerTwoHeroName: string
    playerOnePartnerHeroName: string
    playerTwoPartnerHeroName: string
    firstPlayerUserId: string
}

export interface SeriesScore {
    winnerScore: number
    loserScore: number
}

export interface SeriesResult extends SeriesScore {
    winnerUserId: string
    loserUserId: string
    winnerPartnerUserId: string | null
    loserPartnerUserId: string | null
}

export interface RegisterMatchDto {
    guildId: string
    channelId: string
    registeredByUserId: string
    format: MatchFormat
    seriesLength: SeriesLength
    playerOneUserId: string
    playerOnePartnerUserId: string | null
    playerTwoUserId: string
    playerTwoPartnerUserId: string | null
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
