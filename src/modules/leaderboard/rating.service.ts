import { Injectable } from "@nestjs/common"
import { MatchFormat, SeriesScore } from "./types.js"

export interface RatingDelta {
    winnerDelta: number
    loserDelta: number
}

export interface RatingPlayerCoeffs {
    k1: number
    k2: number
}

export interface RatingCoeffs {
    winner: RatingPlayerCoeffs
    loser: RatingPlayerCoeffs
}

export interface RatingStrategy {
    apply(
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
        coeffs: RatingCoeffs,
    ): RatingDelta
}

const WIN_STREAK_K1_THRESHOLD = 3
const WIN_STREAK_K1_MULTIPLIER = 1.2
const CALIBRATION_K2_NEW_PLAYER = 3
const CALIBRATION_K2_EXISTING_PLAYER = 2

export function computeK1(consecutiveWinsBeforeMatch: number): number {
    return consecutiveWinsBeforeMatch >= WIN_STREAK_K1_THRESHOLD
        ? WIN_STREAK_K1_MULTIPLIER
        : 1
}

export function computeK2(
    isCalibrating: boolean,
    hadExistingRating: boolean,
): number {
    if (!isCalibrating) {
        return 1
    }

    return hadExistingRating
        ? CALIBRATION_K2_EXISTING_PLAYER
        : CALIBRATION_K2_NEW_PLAYER
}

export function computeRatingDelta(
    winnerRating: number,
    loserRating: number,
    maxPoints: number,
    coeffs: RatingCoeffs,
): RatingDelta {
    if (maxPoints === 0) {
        return { winnerDelta: 0, loserDelta: 0 }
    }

    const ratingDiff = loserRating - winnerRating
    const expected = maxPoints / (1 + Math.pow(10, ratingDiff / 400))
    const base = maxPoints - expected
    const diffFactor = 1 + ratingDiff / 400

    return {
        winnerDelta: Math.round(
            base * coeffs.winner.k1 * coeffs.winner.k2 * diffFactor,
        ),
        loserDelta: Math.round(-base * coeffs.loser.k2 * diffFactor),
    }
}

function resolveMaxPoints(
    format: MatchFormat,
    seriesScore: SeriesScore,
): number | null {
    const { winnerScore, loserScore } = seriesScore

    switch (format) {
        case MatchFormat.Bo1:
            return 10
        case MatchFormat.Bo2:
            if (winnerScore === 1 && loserScore === 1) {
                return 0
            }

            if (winnerScore === 2 && loserScore === 0) {
                return 20
            }

            return null
        case MatchFormat.Bo3:
            if (winnerScore === 2 && loserScore === 0) {
                return 20
            }

            if (winnerScore === 2 && loserScore === 1) {
                return 10
            }

            return null
        case MatchFormat.Bo5:
            return null
    }
}

class EloRatingStrategy implements RatingStrategy {
    constructor(private readonly format: MatchFormat) {}

    apply(
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
        coeffs: RatingCoeffs,
    ): RatingDelta {
        const maxPoints = resolveMaxPoints(this.format, seriesScore)

        if (maxPoints === null) {
            throw new Error(
                `Unsupported series score ${seriesScore.winnerScore}:${seriesScore.loserScore} for ${this.format}`,
            )
        }

        return computeRatingDelta(winnerRating, loserRating, maxPoints, coeffs)
    }
}

class StubRatingStrategy implements RatingStrategy {
    apply(): RatingDelta {
        return { winnerDelta: 1, loserDelta: -1 }
    }
}

@Injectable()
export class LeaderboardRatingService {
    private readonly strategies: Record<MatchFormat, RatingStrategy> = {
        [MatchFormat.Bo1]: new EloRatingStrategy(MatchFormat.Bo1),
        [MatchFormat.Bo2]: new EloRatingStrategy(MatchFormat.Bo2),
        [MatchFormat.Bo3]: new EloRatingStrategy(MatchFormat.Bo3),
        [MatchFormat.Bo5]: new StubRatingStrategy(),
    }

    applyResult(
        format: MatchFormat,
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
        coeffs: RatingCoeffs,
    ): RatingDelta {
        return this.strategies[format].apply(
            winnerRating,
            loserRating,
            seriesScore,
            coeffs,
        )
    }

    applyDelta(rating: number, delta: number): number {
        return rating + delta
    }
}
