import { describe, expect, it } from "vitest"
import { DEFAULT_TIER_DEFINITIONS } from "../types.js"

describe("DEFAULT_TIER_DEFINITIONS", () => {
    it("starts at 0-99 and steps by 100", () => {
        expect(DEFAULT_TIER_DEFINITIONS[0]).toEqual({
            name: "0-99",
            minRating: 0,
            maxRating: 100,
        })
        expect(DEFAULT_TIER_DEFINITIONS[1]).toEqual({
            name: "100-199",
            minRating: 100,
            maxRating: 200,
        })
        expect(DEFAULT_TIER_DEFINITIONS.at(-2)).toEqual({
            name: "1900-1999",
            minRating: 1900,
            maxRating: 2000,
        })
        expect(DEFAULT_TIER_DEFINITIONS.at(-1)).toEqual({
            name: "2000+",
            minRating: 2000,
            maxRating: null,
        })
        expect(DEFAULT_TIER_DEFINITIONS).toHaveLength(21)
    })
})
