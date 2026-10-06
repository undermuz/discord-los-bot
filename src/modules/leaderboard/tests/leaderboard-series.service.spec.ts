import { describe, expect, it } from "vitest"
import { LeaderboardCatalogService } from "../catalog.service.js"
import { LeaderboardSeriesService } from "../series.service.js"
import { MatchFormat, SeriesLength } from "../types.js"

describe("LeaderboardSeriesService", () => {
    const service = new LeaderboardSeriesService(
        new LeaderboardCatalogService(),
    )
    const playerA = "player-a"
    const playerB = "player-b"
    const partnerA = "partner-a"
    const partnerB = "partner-b"
    const round = (overrides: {
        roundNumber: number
        winnerUserId: string
        mapName: string
        firstPlayerUserId?: string
        playerOneHeroName?: string
        playerTwoHeroName?: string
        playerOnePartnerHeroName?: string
        playerTwoPartnerHeroName?: string
    }) => ({
        playerOneHeroName: "Achilles",
        playerTwoHeroName: "Alice",
        playerOnePartnerHeroName: "",
        playerTwoPartnerHeroName: "",
        firstPlayerUserId: playerA,
        ...overrides,
    })

    const derive = (
        seriesLength: SeriesLength,
        rounds: ReturnType<typeof round>[],
        format: MatchFormat = MatchFormat.OneVsOne,
        playerOnePartnerUserId: string | null = null,
        playerTwoPartnerUserId: string | null = null,
    ) =>
        service.deriveSeriesResult(
            playerA,
            playerOnePartnerUserId,
            playerB,
            playerTwoPartnerUserId,
            format,
            seriesLength,
            rounds,
        )

    it("derives Bo3 2:0 result", () => {
        const result = derive(SeriesLength.Bo3, [
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
        ])

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 2,
            loserScore: 0,
        })
    })

    it("derives Bo3 2:1 result", () => {
        const result = derive(SeriesLength.Bo3, [
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
        ])

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 2,
            loserScore: 1,
        })
    })

    it("derives Bo1 from single round", () => {
        const result = derive(SeriesLength.Bo1, [
            round({
                roundNumber: 1,
                winnerUserId: playerB,
                mapName: "Fayrlund Forest",
                firstPlayerUserId: playerB,
            }),
        ])

        expect(result).toEqual({
            winnerUserId: playerB,
            loserUserId: playerA,
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 1,
            loserScore: 0,
        })
    })

    it("derives Bo2 2:0 result", () => {
        const result = derive(SeriesLength.Bo2, [
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
        ])

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 2,
            loserScore: 0,
        })
    })

    it("counts a 2x2 round win for the partner's side", () => {
        const result = derive(
            SeriesLength.Bo1,
            [
                round({
                    roundNumber: 1,
                    winnerUserId: partnerA,
                    mapName: "McMinnville OR",
                    playerOnePartnerHeroName: "Achilles",
                    playerTwoPartnerHeroName: "Alice",
                }),
            ],
            MatchFormat.TwoVsTwo,
            partnerA,
            partnerB,
        )

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerPartnerUserId: partnerA,
            loserPartnerUserId: partnerB,
            winnerScore: 1,
            loserScore: 0,
        })
    })

    it("rejects extra rounds after series decided", () => {
        expect(() =>
            derive(SeriesLength.Bo3, [
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
            derive(SeriesLength.Bo3, [
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
            derive(SeriesLength.Bo1, [
                round({
                    roundNumber: 1,
                    winnerUserId: "other",
                    mapName: "McMinnville OR",
                }),
            ]),
        ).toThrow("Round winner must be one of the players")
    })

    it("derives LosEnduranceAutumn2026 without hero names", () => {
        const result = derive(
            SeriesLength.Bo1,
            [
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "McMinnville OR",
                    playerOneHeroName: "",
                    playerTwoHeroName: "",
                }),
            ],
            MatchFormat.LosEnduranceAutumn2026,
        )

        expect(result).toEqual({
            winnerUserId: playerA,
            loserUserId: playerB,
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 1,
            loserScore: 0,
        })
    })

    it("rejects unknown map name", () => {
        expect(() =>
            derive(SeriesLength.Bo1, [
                round({
                    roundNumber: 1,
                    winnerUserId: playerA,
                    mapName: "Inferno",
                }),
            ]),
        ).toThrow("Unknown map for round 1")
    })
})
