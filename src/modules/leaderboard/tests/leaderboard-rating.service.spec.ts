import { describe, expect, it } from "vitest"
import {
    computeK1,
    computeK2,
    computeRatingDelta,
    LeaderboardRatingService,
} from "../rating.service.js"
import { MatchFormat } from "../types.js"

const defaultCoeffs = {
    winner: { k1: 1, k2: 1 },
    loser: { k1: 1, k2: 1 },
}

describe("rating coefficients", () => {
    it("applies K1 boost from the 4th consecutive win", () => {
        expect(computeK1(0)).toBe(1)
        expect(computeK1(2)).toBe(1)
        expect(computeK1(3)).toBe(1.2)
    })

    it("applies calibration K2 multipliers", () => {
        expect(computeK2(false, false)).toBe(1)
        expect(computeK2(false, true)).toBe(1)
        expect(computeK2(true, false)).toBe(3)
        expect(computeK2(true, true)).toBe(2)
    })
})

describe("computeRatingDelta", () => {
    it("returns symmetric deltas for equal ratings in Bo1", () => {
        const result = computeRatingDelta(1000, 1000, 10, defaultCoeffs)

        expect(result).toEqual({ winnerDelta: 5, loserDelta: -5 })
    })

    it("scales winner gain with K1 and K2", () => {
        const result = computeRatingDelta(1000, 1000, 10, {
            winner: { k1: 1.2, k2: 3 },
            loser: { k1: 1, k2: 1 },
        })

        expect(result).toEqual({ winnerDelta: 18, loserDelta: -5 })
    })
})

describe("LeaderboardRatingService", () => {
    const service = new LeaderboardRatingService()

    it("applies Bo1 formula", () => {
        const result = service.applyResult(
            MatchFormat.Bo1,
            1000,
            1000,
            { winnerScore: 1, loserScore: 0 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 5, loserDelta: -5 })
    })

    it("keeps rating unchanged for Bo2 1:1", () => {
        const result = service.applyResult(
            MatchFormat.Bo2,
            1000,
            1000,
            { winnerScore: 1, loserScore: 1 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 0, loserDelta: 0 })
    })

    it("applies Bo2 2:0 with doubled base", () => {
        const result = service.applyResult(
            MatchFormat.Bo2,
            1000,
            1000,
            { winnerScore: 2, loserScore: 0 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 10, loserDelta: -10 })
    })

    it("applies Bo3 2:0 with base 20", () => {
        const result = service.applyResult(
            MatchFormat.Bo3,
            1000,
            1000,
            { winnerScore: 2, loserScore: 0 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 10, loserDelta: -10 })
    })

    it("applies Bo3 2:1 with base 10", () => {
        const result = service.applyResult(
            MatchFormat.Bo3,
            1000,
            1000,
            { winnerScore: 2, loserScore: 1 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 5, loserDelta: -5 })
    })

    it("keeps Bo5 stub +1/-1", () => {
        const result = service.applyResult(
            MatchFormat.Bo5,
            1000,
            1000,
            { winnerScore: 3, loserScore: 2 },
            defaultCoeffs,
        )

        expect(result).toEqual({ winnerDelta: 1, loserDelta: -1 })
    })

    it("applies delta to rating", () => {
        expect(service.applyDelta(1000, 5)).toBe(1005)
        expect(service.applyDelta(1000, -5)).toBe(995)
        expect(service.applyDelta(1000, 4.567)).toBe(1004.57)
    })

    it("returns fractional deltas for uneven ratings", () => {
        const result = computeRatingDelta(1050, 1000, 10, defaultCoeffs)

        expect(result.winnerDelta).toBe(3.75)
        expect(result.loserDelta).toBe(-3.75)
    })
})
