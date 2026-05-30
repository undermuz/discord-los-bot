import { describe, expect, it } from "vitest"
import { formatRussianList } from "./list-format.util.js"

describe("formatRussianList", () => {
    it("returns empty string for empty array", () => {
        expect(formatRussianList([])).toBe("")
    })

    it("returns single item as-is", () => {
        expect(formatRussianList(["Alice"])).toBe("Alice")
    })

    it('joins two items with " и "', () => {
        expect(formatRussianList(["Alice", "Bob"])).toBe("Alice и Bob")
    })

    it('joins multiple items with commas and " и "', () => {
        expect(formatRussianList(["Alice", "Bob", "Charlie"])).toBe(
            "Alice, Bob и Charlie",
        )
    })

    it("respects limit parameter", () => {
        expect(formatRussianList(["Alice", "Bob", "Charlie"], 2)).toBe(
            "Alice и Bob",
        )
    })
})
