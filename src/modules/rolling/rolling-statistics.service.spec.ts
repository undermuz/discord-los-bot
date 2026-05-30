import { beforeEach, describe, expect, it } from "vitest"
import { RollingStatisticsService } from "./rolling-statistics.service.js"

describe("RollingStatisticsService", () => {
    let service: RollingStatisticsService

    beforeEach(() => {
        service = new RollingStatisticsService()
    })

    describe("processWinner / processLoser", () => {
        it("increments streak counters", () => {
            expect(service.processWinner("ch1", "u1")).toBe(0)
            expect(service.processWinner("ch1", "u1")).toBe(1)
            expect(service.processLoser("ch1", "u2")).toBe(0)
            expect(service.processLoser("ch1", "u2")).toBe(1)
        })

        it("isolates stats by channel", () => {
            service.processWinner("ch1", "u1")
            service.processWinner("ch2", "u1")

            expect(service.getStatistics("ch1").winners).toEqual({ u1: 0 })
            expect(service.getStatistics("ch2").winners).toEqual({ u1: 0 })
        })
    })

    describe("dropFromWinners / dropFromLosers", () => {
        it("clears streak for user", () => {
            service.processWinner("ch1", "u1")
            service.processWinner("ch1", "u1")
            service.dropFromWinners("ch1", "u1")

            expect(service.getStatistics("ch1").winners).toEqual({})
        })
    })

    describe("getPostfixText", () => {
        it("returns empty string for count 0", () => {
            expect(service.getPostfixText(0)).toBe("")
        })

        it("returns repeated exclamation marks for low counts", () => {
            expect(service.getPostfixText(2, true)).toBe("❗❗")
            expect(service.getPostfixText(3, false)).toBe("❗❗❗ 👍")
        })

        it("returns custom messages for high counts", () => {
            expect(service.getPostfixText(6, true)).toBe(" Это баг? x6")
            expect(service.getPostfixText(8, true)).toBe(" Олег? x8")
            expect(service.getPostfixText(10, true)).toContain("x10")
        })
    })
})
