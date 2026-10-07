import { Logger } from "@nestjs/common"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockRepository } from "../../../../test/helpers/typeorm.mock.js"
import {
    MatchConfirmation,
    RatingMatch,
    RatingMatchPlayerChange,
    RatingMatchRound,
} from "../../../database/entities/rating-match.entity.js"
import {
    PlayerRating,
    PlayerState,
} from "../../../database/entities/player-rating.entity.js"
import { LeaderboardAggregateService } from "../aggregate.service.js"
import { LeaderboardCatalogService } from "../catalog.service.js"
import { LeaderboardConfigService } from "../config.service.js"
import { LeaderboardRatingService } from "../rating.service.js"
import { LeaderboardRoleService } from "../role.service.js"
import { LeaderboardSeriesService } from "../series.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchFormat, MatchStatus, SeriesLength } from "../types.js"

describe("LeaderboardService", () => {
    let service: LeaderboardService
    let matchRepository: ReturnType<typeof createMockRepository<RatingMatch>>
    let confirmationRepository: ReturnType<
        typeof createMockRepository<MatchConfirmation>
    >
    let roundRepository: ReturnType<
        typeof createMockRepository<RatingMatchRound>
    >
    let playerChangeRepository: ReturnType<
        typeof createMockRepository<RatingMatchPlayerChange>
    >
    let playerRatingRepository: ReturnType<
        typeof createMockRepository<PlayerRating>
    >
    let playerStateRepository: ReturnType<
        typeof createMockRepository<PlayerState>
    >
    let savedRounds: RatingMatchRound[]
    let savedConfirmations: MatchConfirmation[]
    let transactionSaves: unknown[]

    beforeEach(() => {
        matchRepository = createMockRepository<RatingMatch>()
        confirmationRepository = createMockRepository<MatchConfirmation>()
        roundRepository = createMockRepository<RatingMatchRound>()
        playerChangeRepository = createMockRepository<RatingMatchPlayerChange>()
        playerRatingRepository = createMockRepository<PlayerRating>()
        playerStateRepository = createMockRepository<PlayerState>()
        savedRounds = []
        savedConfirmations = []
        transactionSaves = []
        playerChangeRepository.find.mockResolvedValue([])
        matchRepository.save.mockImplementation((entity) => entity)

        const dataSourceManager = {
            transaction: vi.fn(
                async (
                    callback: (manager: {
                        create: (
                            _entity: unknown,
                            data: Record<string, unknown>,
                        ) => Record<string, unknown>
                        save: (
                            entity:
                                | Record<string, unknown>
                                | Record<string, unknown>[],
                        ) => Promise<unknown>
                        find: (
                            entity: unknown,
                            options?: object,
                        ) => Promise<unknown>
                        findOne: (
                            entity: unknown,
                            options?: object,
                        ) => Promise<unknown>
                    }) => Promise<unknown>,
                ) => {
                    const manager = {
                        create: (
                            _entity: unknown,
                            data: Record<string, unknown>,
                        ) => data,
                        save: vi.fn(
                            (
                                entity:
                                    | Record<string, unknown>
                                    | Record<string, unknown>[],
                            ) => {
                                transactionSaves.push(entity)

                                if (Array.isArray(entity)) {
                                    savedRounds.push(
                                        ...(entity as RatingMatchRound[]),
                                    )
                                    return entity
                                }

                                if ("autoConfirmed" in entity) {
                                    savedConfirmations.push(
                                        entity as MatchConfirmation,
                                    )
                                }

                                return {
                                    id: 1,
                                    ...entity,
                                }
                            },
                        ),
                        find: vi.fn((entity: unknown, options?: object) => {
                            if (entity === RatingMatchPlayerChange) {
                                return playerChangeRepository.find(options as never)
                            }

                            return []
                        }),
                        findOne: vi.fn((entity: unknown, options?: object) => {
                            if (entity === PlayerRating) {
                                return playerRatingRepository.findOne(
                                    options as never,
                                )
                            }

                            return null
                        }),
                    }

                    return callback(manager)
                },
            ),
        }

        Object.defineProperty(matchRepository, "manager", {
            value: dataSourceManager,
        })
        Object.defineProperty(playerChangeRepository, "manager", {
            value: dataSourceManager,
        })

        const configService = {
            requireGuildConfig: vi.fn().mockResolvedValue({
                guildId: "g1",
                favoriteFormats: ["1x1"],
                verifyEmoji: "✅",
                rejectEmoji: "❌",
                calibrationRoleId: "cal",
                freezeRoleId: "freeze",
                calibrationMatchThreshold: 10,
                inactivityDays: 60,
                initialRating: 1000,
            }),
        } as unknown as LeaderboardConfigService

        service = new LeaderboardService(
            matchRepository,
            confirmationRepository,
            roundRepository,
            playerChangeRepository,
            playerRatingRepository,
            playerStateRepository,
            configService,
            new LeaderboardRatingService(),
            new LeaderboardAggregateService(playerRatingRepository),
            new LeaderboardRoleService(),
            new LeaderboardSeriesService(new LeaderboardCatalogService()),
        )
    })

    it("rejects a series that the format does not allow", async () => {
        await expect(
            service.registerMatch({
                guildId: "g1",
                channelId: "c1",
                registeredByUserId: "player-a",
                format: MatchFormat.TwoVsTwo,
                seriesLength: SeriesLength.Bo3,
                playerOnePartnerUserId: "player-c",
                playerTwoPartnerUserId: "player-d",
                playerOneUserId: "player-a",
                playerTwoUserId: "player-b",
                rounds: [],
            }),
        ).rejects.toThrow("Series Bo3 is not available for 2x2")
    })

    it("auto-confirms registrant participant on register", async () => {
        await service.registerMatch({
            guildId: "g1",
            channelId: "c1",
            registeredByUserId: "player-a",
            format: MatchFormat.OneVsOne,
            seriesLength: SeriesLength.Bo1,
            playerOnePartnerUserId: null,
            playerTwoPartnerUserId: null,
            playerOneUserId: "player-a",
            playerTwoUserId: "player-b",
            rounds: [
                {
                    roundNumber: 1,
                    winnerUserId: "player-a",
                    mapName: "McMinnville OR",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
                    playerOnePartnerHeroName: "",
                    playerTwoPartnerHeroName: "",
                    firstPlayerUserId: "player-a",
                },
            ],
        })

        expect(savedConfirmations).toEqual([
            expect.objectContaining({
                matchId: 1,
                discordUserId: "player-a",
                autoConfirmed: true,
            }),
        ])
    })

    it("stores rounds and series score on register", async () => {
        await service.registerMatch({
            guildId: "g1",
            channelId: "c1",
            registeredByUserId: "player-a",
            format: MatchFormat.OneVsOne,
            seriesLength: SeriesLength.Bo3,
            playerOnePartnerUserId: null,
            playerTwoPartnerUserId: null,
            playerOneUserId: "player-a",
            playerTwoUserId: "player-b",
            rounds: [
                {
                    roundNumber: 1,
                    winnerUserId: "player-a",
                    mapName: "McMinnville OR",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
                    playerOnePartnerHeroName: "",
                    playerTwoPartnerHeroName: "",
                    firstPlayerUserId: "player-a",
                },
                {
                    roundNumber: 2,
                    winnerUserId: "player-a",
                    mapName: "Point Pleasant",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
                    playerOnePartnerHeroName: "",
                    playerTwoPartnerHeroName: "",
                    firstPlayerUserId: "player-b",
                },
            ],
        })

        expect(savedRounds).toEqual([
            expect.objectContaining({
                roundNumber: 1,
                mapName: "McMinnville OR",
                winnerUserId: "player-a",
                loserUserId: "player-b",
            }),
            expect.objectContaining({
                roundNumber: 2,
                mapName: "Point Pleasant",
                winnerUserId: "player-a",
                loserUserId: "player-b",
            }),
        ])
    })

    it("finalizes match when all participants confirmed", async () => {
        matchRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            channelId: "c1",
            messageId: "m1",
            format: MatchFormat.OneVsOne,
            seriesLength: SeriesLength.Bo3,
            playerOnePartnerUserId: null,
            playerTwoPartnerUserId: null,
            registeredByUserId: "winner",
            winnerUserId: "winner",
            loserUserId: "loser",
            winnerScore: 2,
            loserScore: 1,
            status: MatchStatus.Pending,
        })
        confirmationRepository.find.mockResolvedValue([
            { discordUserId: "winner" },
            { discordUserId: "loser" },
        ])
        playerRatingRepository.findOne.mockResolvedValue(null)
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve({
                id: 1,
                verifiedMatchCount: 0,
                rating: 1000,
                ...(Array.isArray(entity) ? entity[0] : entity),
            }),
        )
        playerStateRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "winner",
            isFrozen: false,
        })
        matchRepository.find.mockResolvedValue([])
        matchRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const result = await service.finalizeMatch(1)

        expect(result.status).toBe(MatchStatus.Verified)
        expect(playerRatingRepository.save).toHaveBeenCalled()

        const changeRows = transactionSaves.find(
            (saved): saved is Array<Record<string, unknown>> =>
                Array.isArray(saved) &&
                saved.some(
                    (row) =>
                        !!row &&
                        typeof row === "object" &&
                        "ratingDelta" in row,
                ),
        )

        expect(changeRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    matchId: 1,
                    discordUserId: "winner",
                    format: MatchFormat.OneVsOne,
                    calibrationCompletedBefore: false,
                    lastPlayedAtBefore: null,
                }),
                expect.objectContaining({
                    matchId: 1,
                    discordUserId: "loser",
                    format: MatchFormat.OneVsOne,
                    calibrationCompletedBefore: false,
                    lastPlayedAtBefore: null,
                }),
            ]),
        )
        expect(
            changeRows?.every(
                (row) =>
                    typeof row.ratingDelta === "number" &&
                    row.ratingDelta !== 0,
            ),
        ).toBe(true)
    })

    it("rejects invalid series rounds", async () => {
        await expect(
            service.registerMatch({
                guildId: "g1",
                channelId: "c1",
                registeredByUserId: "player-a",
                format: MatchFormat.OneVsOne,
                seriesLength: SeriesLength.Bo3,
                playerOnePartnerUserId: null,
                playerTwoPartnerUserId: null,
                playerOneUserId: "player-a",
                playerTwoUserId: "player-b",
                rounds: [
                    {
                        roundNumber: 1,
                        winnerUserId: "player-a",
                        mapName: "McMinnville OR",
                        playerOneHeroName: "Achilles",
                        playerTwoHeroName: "Alice",
                        playerOnePartnerHeroName: "",
                        playerTwoPartnerHeroName: "",
                        firstPlayerUserId: "player-a",
                    },
                ],
            }),
        ).rejects.toThrow("Series score must reach 2 wins for Bo3")
    })

    it("returns top players sorted by main rating", async () => {
        playerRatingRepository.find.mockImplementation(({ where }) => {
            const allRatings = [
                {
                    guildId: "g1",
                    discordUserId: "u1",
                    format: MatchFormat.OneVsOne,
                    rating: 1100,
                    verifiedMatchCount: 5,
                },
                {
                    guildId: "g1",
                    discordUserId: "u2",
                    format: MatchFormat.OneVsOne,
                    rating: 1200,
                    verifiedMatchCount: 3,
                },
                {
                    guildId: "g1",
                    discordUserId: "u3",
                    format: MatchFormat.OneVsOne,
                    rating: 1300,
                    verifiedMatchCount: 0,
                },
            ]

            if (
                where.guildId &&
                !where.discordUserId &&
                !Array.isArray(where)
            ) {
                return Promise.resolve(
                    allRatings.filter(
                        (rating) => rating.guildId === where.guildId,
                    ),
                )
            }

            const filters = Array.isArray(where) ? where : [where]

            return Promise.resolve(
                allRatings.filter((rating) =>
                    filters.some(
                        (filter) =>
                            rating.guildId === filter.guildId &&
                            rating.discordUserId === filter.discordUserId &&
                            (!filter.format || rating.format === filter.format),
                    ),
                ),
            )
        })
        playerStateRepository.findOne.mockResolvedValue(null)
        playerStateRepository.save.mockImplementation((entity) =>
            Promise.resolve({ id: 1, ...entity }),
        )

        const top = await service.getTopPlayers("g1", 10)

        expect(top).toEqual([
            expect.objectContaining({
                discordUserId: "u2",
                mainRating: 1200,
            }),
            expect.objectContaining({
                discordUserId: "u1",
                mainRating: 1100,
            }),
        ])
    })

    it("resets player rating to guild initial rating", async () => {
        playerRatingRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            format: MatchFormat.OneVsOne,
            rating: 1300,
            verifiedMatchCount: 5,
            lastPlayedAt: new Date(),
        })
        playerRatingRepository.find.mockResolvedValue([
            {
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.OneVsOne,
                rating: 1000,
            },
        ])
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const mainRating = await service.resetPlayerRating("g1", "u1")

        expect(mainRating).toBe(1000)
        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ rating: 1000 })]),
        )
    })

    it("sets player rating to custom value across formats", async () => {
        playerRatingRepository.findOne.mockResolvedValue(null)
        playerRatingRepository.find.mockResolvedValue([
            {
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.OneVsOne,
                rating: 1250,
            },
        ])
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const mainRating = await service.resetPlayerRating("g1", "u1", 1250)

        expect(mainRating).toBe(1250)
        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ rating: 1250 })]),
        )
    })

    it("resets player statistics and clears freeze", async () => {
        playerRatingRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            format: MatchFormat.OneVsOne,
            rating: 1200,
            verifiedMatchCount: 12,
            lastPlayedAt: new Date("2025-01-01"),
        })
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )
        playerStateRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            isFrozen: true,
        })
        playerStateRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        await service.resetPlayerStats("g1", "u1")

        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    verifiedMatchCount: 0,
                    lastPlayedAt: null,
                }),
            ]),
        )
        expect(playerStateRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({ isFrozen: false }),
        )
    })

    it("freezes inactive player into re-calibration without resetting rating", async () => {
        playerRatingRepository.find.mockResolvedValue([
            {
                id: 1,
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.OneVsOne,
                rating: 1234.56,
                verifiedMatchCount: 20,
                calibrationCompleted: true,
                lastPlayedAt: new Date("2024-01-01"),
            },
        ])
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )
        playerStateRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            isFrozen: false,
        })
        playerStateRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        await service.freezeInactivePlayer("g1", "u1")

        expect(playerStateRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({ isFrozen: true }),
        )
        expect(playerRatingRepository.save).toHaveBeenCalledWith([
            expect.objectContaining({
                rating: 1234.56,
                verifiedMatchCount: 0,
                calibrationCompleted: true,
            }),
        ])
    })

    it("resets calibration history when requested", async () => {
        playerRatingRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            format: MatchFormat.OneVsOne,
            rating: 1200,
            verifiedMatchCount: 12,
            calibrationCompleted: true,
            lastPlayedAt: new Date("2025-01-01"),
        })
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )
        playerStateRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            isFrozen: false,
        })

        await service.resetPlayerStats("g1", "u1", true)

        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    verifiedMatchCount: 0,
                    calibrationCompleted: false,
                }),
            ]),
        )
    })

    function pendingMatch(status = MatchStatus.Pending): RatingMatch {
        return {
            id: 7,
            guildId: "g1",
            channelId: "c1",
            messageId: "m1",
            format: MatchFormat.OneVsOne,
            seriesLength: SeriesLength.Bo1,
            registeredByUserId: "winner",
            winnerUserId: "winner",
            loserUserId: "loser",
            winnerPartnerUserId: null,
            loserPartnerUserId: null,
            winnerScore: 1,
            loserScore: 0,
            status,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            verifiedAt:
                status === MatchStatus.Verified
                    ? new Date("2026-01-02T00:00:00.000Z")
                    : null,
            cancelledAt: null,
            cancelledByUserId: null,
        }
    }

    it("lets a participant cancel a pending match without touching ratings", async () => {
        const match = pendingMatch()
        matchRepository.findOne.mockResolvedValue(match)

        const result = await service.cancelMatch("g1", "m1", "winner", false)

        expect(result).toEqual({
            match: expect.objectContaining({
                status: MatchStatus.Cancelled,
                cancelledByUserId: "winner",
                cancelledAt: expect.any(Date),
            }),
            ratingReverted: false,
        })
        expect(playerRatingRepository.save).not.toHaveBeenCalled()
        expect(playerChangeRepository.find).not.toHaveBeenCalled()
    })

    it("lets an admin cancel a pending match", async () => {
        matchRepository.findOne.mockResolvedValue(pendingMatch())

        const result = await service.cancelMatch("g1", "m1", "admin-1", true)

        expect(result?.match.status).toBe(MatchStatus.Cancelled)
        expect(result?.match.cancelledByUserId).toBe("admin-1")
        expect(result?.ratingReverted).toBe(false)
    })

    it("rejects cancellation of a pending match by anyone else", async () => {
        matchRepository.findOne.mockResolvedValue(pendingMatch())

        const result = await service.cancelMatch("g1", "m1", "stranger", false)

        expect(result).toBeNull()
        expect(matchRepository.save).not.toHaveBeenCalled()
    })

    it("rejects cancellation of a verified match by a participant who is not an admin", async () => {
        matchRepository.findOne.mockResolvedValue(
            pendingMatch(MatchStatus.Verified),
        )

        const result = await service.cancelMatch("g1", "m1", "winner", false)

        expect(result).toBeNull()
        expect(matchRepository.manager.transaction).not.toHaveBeenCalled()
    })

    it("reverts stored rating changes when an admin cancels a verified match", async () => {
        const verifiedAt = new Date("2026-01-02T00:00:00.000Z")
        const previousPlayedAt = new Date("2025-06-01T00:00:00.000Z")
        const laterPlayedAt = new Date("2026-03-01T00:00:00.000Z")
        const match = pendingMatch(MatchStatus.Verified)
        match.verifiedAt = verifiedAt
        const winnerRating = {
            guildId: "g1",
            discordUserId: "winner",
            format: MatchFormat.OneVsOne,
            rating: 1015.5,
            verifiedMatchCount: 10,
            calibrationCompleted: true,
            lastPlayedAt: verifiedAt,
        }
        const loserRating = {
            guildId: "g1",
            discordUserId: "loser",
            format: MatchFormat.OneVsOne,
            rating: 984.5,
            verifiedMatchCount: 10,
            calibrationCompleted: true,
            lastPlayedAt: laterPlayedAt,
        }

        matchRepository.findOne.mockResolvedValue(match)
        playerChangeRepository.find.mockResolvedValue([
            {
                matchId: 7,
                discordUserId: "winner",
                format: MatchFormat.OneVsOne,
                ratingDelta: 15.5,
                calibrationCompletedBefore: true,
                lastPlayedAtBefore: previousPlayedAt,
            },
            {
                matchId: 7,
                discordUserId: "loser",
                format: MatchFormat.OneVsOne,
                ratingDelta: -15.5,
                calibrationCompletedBefore: false,
                lastPlayedAtBefore: null,
            },
        ])
        playerRatingRepository.findOne.mockImplementation((options) => {
            const discordUserId = (
                options as { where?: { discordUserId?: string } }
            ).where?.discordUserId

            if (discordUserId === "winner") {
                return winnerRating
            }

            if (discordUserId === "loser") {
                return loserRating
            }

            return null
        })

        const result = await service.cancelMatch("g1", "m1", "admin-1", true)

        expect(result?.ratingReverted).toBe(true)
        expect(result?.match).toEqual(
            expect.objectContaining({
                status: MatchStatus.Cancelled,
                cancelledByUserId: "admin-1",
            }),
        )
        expect(winnerRating).toEqual(
            expect.objectContaining({
                rating: 1000,
                verifiedMatchCount: 9,
                calibrationCompleted: true,
                lastPlayedAt: previousPlayedAt,
            }),
        )
        expect(loserRating).toEqual(
            expect.objectContaining({
                rating: 1000,
                verifiedMatchCount: 9,
                calibrationCompleted: false,
                lastPlayedAt: laterPlayedAt,
            }),
        )
    })

    it("cancels a verified match without rollback when no rating changes were stored", async () => {
        const warn = vi
            .spyOn(Logger.prototype, "warn")
            .mockImplementation(() => undefined)
        const match = pendingMatch(MatchStatus.Verified)
        matchRepository.findOne.mockResolvedValue(match)
        playerChangeRepository.find.mockResolvedValue([])

        const result = await service.cancelMatch("g1", "m1", "admin-1", true)

        expect(result).toEqual({
            match: expect.objectContaining({
                status: MatchStatus.Cancelled,
                cancelledByUserId: "admin-1",
            }),
            ratingReverted: false,
        })
        expect(playerRatingRepository.findOne).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining("no stored rating changes"),
        )
        warn.mockRestore()
    })

    it("returns null when the match is already cancelled", async () => {
        matchRepository.findOne.mockResolvedValue(
            pendingMatch(MatchStatus.Cancelled),
        )

        const result = await service.cancelMatch("g1", "m1", "admin-1", true)

        expect(result).toBeNull()
        expect(matchRepository.save).not.toHaveBeenCalled()
        expect(matchRepository.manager.transaction).not.toHaveBeenCalled()
    })
})
