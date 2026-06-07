import { describe, expect, it } from "vitest"
import { LeaderboardSeriesService } from "../series.service.js"
import { MatchFormat } from "../types.js"

describe("LeaderboardSeriesService", () => {
    const service = new LeaderboardSeriesService()
    const playerA = "player-a"
    const playerB = "player-b"
    const round = (overrides: {
        roundNumber: number
        winnerUserId: string
        mapName: string
        firstPlayerUserId?: string
        playerOneHeroName?: string
        playerTwoHeroName?: string
    }) => ({
        playerOneHeroName: "Achilles",
        playerTwoHeroName: "Alice",
        firstPlayerUserId: playerA,
        ...overrides,
    })

    it("derives Bo3 2:0 result", () => {
        const result = service.deriveSeriesResult(
            playerA,
            playerB,
            MatchFormat.Bo3,
            [
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "McMinnville OR",
                }),
                round({
                    roundNumber: 2,
                    winnerUserId: playerA,
                    mapName: "Point Pleasant",
                }),
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
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "McMinnville OR",
                }),
                round({
                    roundNumber: 2,
                    winnerUserId: playerB,
                    mapName: "Point Pleasant",
                    firstPlayerUserId: playerB,
                }),
                round({
                    roundNumber: 3,
                    winnerUserId: playerA,
                    mapName: "Baskerville Manor",
                }),
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
            [
                round({
                    roundNumber: 1,
                    winnerUserId: playerB,
                    mapName: "Fayrlund Forest",
                    firstPlayerUserId: playerB,
                }),
            ],
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
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "McMinnville OR",
                }),
                round({
                    roundNumber: 2,
                    winnerUserId: playerA,
                    mapName: "Point Pleasant",
                }),
                round({
                    roundNumber: 3,
                    winnerUserId: playerB,
                    mapName: "Baskerville Manor",
                    firstPlayerUserId: playerB,
                }),
            ]),
        ).toThrow("Extra rounds after series was decided")
    })

    it("rejects incomplete series score", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo3, [
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "McMinnville OR",
                }),
            ]),
        ).toThrow("Series score must reach 2 wins for Bo3")
    })

    it("rejects winner outside participants", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo1, [
                round({
                    roundNumber: 1,
                    winnerUserId: "other",
                    mapName: "McMinnville OR",
                }),
            ]),
        ).toThrow("Round winner must be one of the players")
    })

    it("rejects unknown map name", () => {
        expect(() =>
            service.deriveSeriesResult(playerA, playerB, MatchFormat.Bo1, [
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "Inferno",
                }),
            ]),
        ).toThrow("Unknown map for round 1")
    })
})
