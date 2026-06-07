import { describe, expect, it } from "vitest"
import { LeaderboardRatingService } from "../rating.service.js"
import { MatchFormat } from "../types.js"

describe("LeaderboardRatingService", () => {
    const service = new LeaderboardRatingService()

    it.each([
        MatchFormat.Bo1,
        MatchFormat.Bo2,
        MatchFormat.Bo3,
        MatchFormat.Bo5,
    ])("applies stub +1/-1 for %s", (format) => {
        const result = service.applyResult(format, 1000, 1000, {
            winnerScore: 2,
            loserScore: 1,
        })

        expect(result).toEqual({ winnerDelta: 1, loserDelta: -1 })
    })

    it("accepts series score in applyResult contract", () => {
        const result = service.applyResult(MatchFormat.Bo3, 1000, 1000, {
            winnerScore: 2,
            loserScore: 0,
        })

        expect(result.winnerDelta).toBe(1)
    })

    it("applies delta to rating", () => {
        expect(service.applyDelta(1000, 1)).toBe(1001)
        expect(service.applyDelta(1000, -1)).toBe(999)
    })
})
