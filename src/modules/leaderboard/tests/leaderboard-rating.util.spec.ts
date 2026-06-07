import { describe, expect, it } from "vitest"
import { formatRating, roundRating } from "../rating.util.js"

describe("rating precision helpers", () => {
    it("rounds to hundredths", () => {
        expect(roundRating(1000.004)).toBe(1000)
        expect(roundRating(1000.005)).toBe(1000.01)
        expect(roundRating(1004.567)).toBe(1004.57)
    })

    it("formats with two decimal places", () => {
        expect(formatRating(1000)).toBe("1000.00")
        expect(formatRating(1004.5)).toBe("1004.50")
        expect(formatRating(1004.567)).toBe("1004.57")
    })
})
