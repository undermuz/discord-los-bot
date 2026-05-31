import { describe, expect, it } from "vitest"
import { LeaderboardSeriesService } from "./leaderboard-series.service.js"
import { MatchFormat } from "./leaderboard.types.js"

describe("LeaderboardSeriesService", () => {
    const service = new LeaderboardSeriesService()
    const playerA = "player-a"
    const playerB = "player-b"

    it("derives Bo3 2:0 result", () => {
        const result = service.deriveSeriesResult(
            playerA,
            playerB,
            MatchFormat.Bo3,
            [
                { roundNumber: 1, winnerUserId: playerA, mapName: "Inferno" },
                { roundNumber: 2, winnerUserId: playerA, mapName: "Dust2" },
            ],
        )

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerScore: 2,
            loserScore: 0,
        })
    })

    it("derives Bo3 2:1 result", () => {
        const result = service.deriveSeriesResult(
            playerA,
            playerB,
            MatchFormat.Bo3,
            [
                { roundNumber: 1, winnerUserId: playerA, mapName: "Inferno" },
                { roundNumber: 2, winnerUserId: playerB, mapName: "Dust2" },
                { roundNumber: 3, winnerUserId: playerA, mapName: "Mirage" },
            ],
        )

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerScore: 2,
            loserScore: 1,
        })
    })

    it("derives Bo1 from single round", () => {
        const result = service.deriveSeriesResult(
            playerA,
            playerB,
            MatchFormat.Bo1,
            [{ roundNumber: 1, winnerUserId: playerB, mapName: "Nuke" }],
        )

        expect(result).toEqual({
            winnerUserId: playerB,
            loserUserId: playerA,
            winnerScore: 1,
            loserScore: 0,
        })
    })

    it("rejects extra rounds after series decided", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo3, [
                { roundNumber: 1, winnerUserId: playerA, mapName: "Inferno" },
                { roundNumber: 2, winnerUserId: playerA, mapName: "Dust2" },
                { roundNumber: 3, winnerUserId: playerB, mapName: "Mirage" },
            ]),
        ).toThrow("Extra rounds after series was decided")
    })

    it("rejects incomplete series score", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo3, [
                { roundNumber: 1, winnerUserId: playerA, mapName: "Inferno" },
            ]),
        ).toThrow("Series score must reach 2 wins for Bo3")
    })

    it("rejects winner outside participants", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo1, [
                { roundNumber: 1, winnerUserId: "other", mapName: "Inferno" },
            ]),
        ).toThrow("Round winner must be one of the players")
    })
})
