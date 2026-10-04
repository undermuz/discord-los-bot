import { Injectable } from "@nestjs/common"
import { roundRating } from "./rating.util.js"
import { SeriesLength, SeriesScore } from "./types.js"

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
    hasCompletedCalibrationBefore: boolean,
): number {
    if (!isCalibrating) {
        return 1
    }

    return hasCompletedCalibrationBefore
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
        winnerDelta: roundRating(
            base * coeffs.winner.k1 * coeffs.winner.k2 * diffFactor,
        ),
        loserDelta: roundRating(-base * coeffs.loser.k2 * diffFactor),
    }
}

function resolveMaxPoints(
    seriesLength: SeriesLength,
    seriesScore: SeriesScore,
): number | null {
    const { winnerScore, loserScore } = seriesScore

    switch (seriesLength) {
        case SeriesLength.Bo1:
            return 10
        case SeriesLength.Bo2:
            if (winnerScore === 1 && loserScore === 1) {
                return 0
            }

            if (winnerScore === 2 && loserScore === 0) {
                return 20
            }

            return null
        case SeriesLength.Bo3:
            if (winnerScore === 2 && loserScore === 0) {
                return 20
            }

            if (winnerScore === 2 && loserScore === 1) {
                return 10
            }

            return null
        case SeriesLength.Bo5:
            return null
    }
}

class EloRatingStrategy implements RatingStrategy {
    constructor(private readonly seriesLength: SeriesLength) {}

    apply(
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
        coeffs: RatingCoeffs,
    ): RatingDelta {
        const maxPoints = resolveMaxPoints(this.seriesLength, seriesScore)

        if (maxPoints === null) {
            throw new Error(
                `Unsupported series score ${seriesScore.winnerScore}:${seriesScore.loserScore} for ${this.seriesLength}`,
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
    private readonly strategies: Record<SeriesLength, RatingStrategy> = {
        [SeriesLength.Bo1]: new EloRatingStrategy(SeriesLength.Bo1),
        [SeriesLength.Bo2]: new EloRatingStrategy(SeriesLength.Bo2),
        [SeriesLength.Bo3]: new EloRatingStrategy(SeriesLength.Bo3),
        [SeriesLength.Bo5]: new StubRatingStrategy(),
    }

    applyResult(
        seriesLength: SeriesLength,
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
        coeffs: RatingCoeffs,
    ): RatingDelta {
        return this.strategies[seriesLength].apply(
            winnerRating,
            loserRating,
            seriesScore,
            coeffs,
        )
    }

    applyDelta(rating: number, delta: number): number {
        return roundRating(rating + delta)
    }
}
