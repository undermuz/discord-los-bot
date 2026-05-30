import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as randomUtil from "../../common/utils/random.util.js"
import { createMockConfigService } from "../../../test/helpers/config.mock.js"
import { RollingService } from "./rolling.service.js"
import { RollParticipant, RollResult } from "./rolling.types.js"

describe("RollingService", () => {
    let service: RollingService

    beforeEach(() => {
        service = new RollingService(
            createMockConfigService({
                "app.specialUsernames": ["special"],
                "app.specialFlags": ["🎯", "🔥"],
            }),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe("resolveOutcome", () => {
        const participant = (id: string): RollParticipant => ({
            id,
            displayName: id,
        })

        it("identifies winners and losers", () => {
            const results: RollResult[] = [
                { participant: participant("a"), value: 10 },
                { participant: participant("b"), value: 90 },
                { participant: participant("c"), value: 50 },
            ]

            const outcome = service.resolveOutcome(results)

            expect(outcome.winners.map((r) => r.participant.id)).toEqual(["b"])
            expect(outcome.losers.map((r) => r.participant.id)).toEqual(["a"])
            expect(outcome.results.map((r) => r.value)).toEqual([10, 50, 90])
        })

        it("sets minScore to -1 when all values are equal", () => {
            const results: RollResult[] = [
                { participant: participant("a"), value: 50 },
                { participant: participant("b"), value: 50 },
            ]

            const outcome = service.resolveOutcome(results)

            expect(outcome.minScore).toBe(-1)
            expect(outcome.losers).toEqual([])
        })

        it("sets maxScore to -1 when max value is 0", () => {
            const results: RollResult[] = [
                { participant: participant("a"), value: 0 },
                { participant: participant("b"), value: 0 },
            ]

            const outcome = service.resolveOutcome(results)

            expect(outcome.maxScore).toBe(-1)
            expect(outcome.winners).toEqual([])
        })
    })

    describe("getReactionAsset", () => {
        it("returns assets for 0, 99 and 100", () => {
            expect(service.getReactionAsset(0)?.value).toBe(0)
            expect(service.getReactionAsset(99)?.value).toBe(99)
            expect(service.getReactionAsset(100)?.value).toBe(100)
        })

        it("returns null for other values", () => {
            expect(service.getReactionAsset(42)).toBeNull()
        })
    })

    describe("rollParticipants", () => {
        it("rolls each participant within cap", async () => {
            vi.spyOn(randomUtil, "randomIntFromInterval").mockResolvedValue(7)

            const results = await service.rollParticipants([
                { id: "a", displayName: "A" },
                { id: "b", displayName: "B" },
            ])

            expect(results).toHaveLength(2)
            expect(results.every((result) => result.value === 7)).toBe(true)
        })
    })

    describe("pickSpecialFlag", () => {
        it("returns null for non-special username", async () => {
            await expect(service.pickSpecialFlag("regular")).resolves.toBeNull()
        })

        it("returns flag for special username", async () => {
            vi.spyOn(randomUtil, "randomIntFromInterval").mockResolvedValue(1)

            await expect(service.pickSpecialFlag("special_guy")).resolves.toBe(
                "🔥",
            )
        })

        it("returns null when config is empty", async () => {
            const emptyConfigService = new RollingService(
                createMockConfigService({}),
            )
            await expect(
                emptyConfigService.pickSpecialFlag("special"),
            ).resolves.toBeNull()
        })
    })
})
