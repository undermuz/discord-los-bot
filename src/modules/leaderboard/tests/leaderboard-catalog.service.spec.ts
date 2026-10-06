import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LeaderboardCatalogService } from "../catalog.service.js"

vi.mock("node:fs", () => ({
    readFileSync: vi.fn(),
}))

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function catalogJson(names: string[]): string {
    return JSON.stringify({
        maps: names.map((name) => ({ name })),
        heroes: names.map((name) => ({ name })),
    })
}

describe("LeaderboardCatalogService", () => {
    let service: LeaderboardCatalogService

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
        vi.mocked(readFileSync).mockImplementation((filePath) => {
            const path = String(filePath)

            if (path.endsWith("maps.json")) {
                return catalogJson(["Point Pleasant", "McMinnville OR"])
            }

            if (path.endsWith("heroes.json")) {
                return catalogJson(["Alice", "Achilles"])
            }

            throw new Error(`Unexpected file ${path}`)
        })
        service = new LeaderboardCatalogService()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it("filters map and hero autocomplete choices", () => {
        expect(service.getMapAutocompleteChoices("mcminn")).toEqual([
            { name: "McMinnville OR", value: "McMinnville OR" },
        ])
        expect(service.getHeroAutocompleteChoices("")).toEqual([
            { name: "Achilles", value: "Achilles" },
            { name: "Alice", value: "Alice" },
        ])
    })

    it("matches known names case-insensitively", () => {
        expect(service.isKnownMapName("  point pleasant ")).toBe(true)
        expect(service.isKnownMapName("Inferno")).toBe(false)
        expect(service.isKnownHeroName("achilles")).toBe(true)
        expect(service.isKnownHeroName("Unknown")).toBe(false)
    })

    it("reuses the cache until the 24 hour TTL expires", () => {
        expect(service.isKnownMapName("McMinnville OR")).toBe(true)
        expect(readFileSync).toHaveBeenCalledTimes(1)

        vi.mocked(readFileSync).mockImplementation((filePath) => {
            const path = String(filePath)

            if (path.endsWith("maps.json")) {
                return catalogJson(["Baskerville Manor"])
            }

            return catalogJson(["Alice"])
        })

        vi.advanceTimersByTime(CACHE_TTL_MS - 1)
        expect(service.isKnownMapName("McMinnville OR")).toBe(true)
        expect(service.isKnownMapName("Baskerville Manor")).toBe(false)

        vi.advanceTimersByTime(1)
        expect(service.isKnownMapName("McMinnville OR")).toBe(false)
        expect(service.isKnownMapName("Baskerville Manor")).toBe(true)
    })

    it("reloads maps and heroes when the cache is reset", () => {
        expect(service.isKnownHeroName("Achilles")).toBe(true)

        vi.mocked(readFileSync).mockImplementation((filePath) => {
            const path = String(filePath)

            if (path.endsWith("maps.json")) {
                return catalogJson(["Baskerville Manor"])
            }

            return catalogJson(["Medusa"])
        })

        service.resetCache()

        expect(service.isKnownHeroName("Achilles")).toBe(false)
        expect(service.isKnownHeroName("Medusa")).toBe(true)
        expect(service.isKnownMapName("Baskerville Manor")).toBe(true)
        expect(service.isKnownMapName("McMinnville OR")).toBe(false)
    })

    it("keeps the previous cache when a reload fails", () => {
        expect(service.isKnownMapName("McMinnville OR")).toBe(true)
        expect(service.isKnownHeroName("Achilles")).toBe(true)

        vi.mocked(readFileSync).mockImplementation(() => {
            throw new Error("unreadable")
        })

        expect(() => service.resetCache()).toThrow("unreadable")
        expect(service.isKnownMapName("McMinnville OR")).toBe(true)
        expect(service.isKnownHeroName("Achilles")).toBe(true)
    })
})
