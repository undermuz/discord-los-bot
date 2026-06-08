import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockRepository } from "../../../../test/helpers/typeorm.mock.js"
import {
    MatchConfirmation,
    RatingMatch,
    RatingMatchRound,
} from "../../../database/entities/rating-match.entity.js"
import {
    PlayerRating,
    PlayerState,
} from "../../../database/entities/player-rating.entity.js"
import { LeaderboardAggregateService } from "../aggregate.service.js"
import { LeaderboardConfigService } from "../config.service.js"
import { LeaderboardRatingService } from "../rating.service.js"
import { LeaderboardRoleService } from "../role.service.js"
import { LeaderboardSeriesService } from "../series.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchFormat, MatchStatus } from "../types.js"

describe("LeaderboardService", () => {
    let service: LeaderboardService
    let matchRepository: ReturnType<typeof createMockRepository<RatingMatch>>
    let confirmationRepository: ReturnType<
        typeof createMockRepository<MatchConfirmation>
    >
    let roundRepository: ReturnType<
        typeof createMockRepository<RatingMatchRound>
    >
    let playerRatingRepository: ReturnType<
        typeof createMockRepository<PlayerRating>
    >
    let playerStateRepository: ReturnType<
        typeof createMockRepository<PlayerState>
    >
    let savedRounds: RatingMatchRound[]
    let savedConfirmations: MatchConfirmation[]

    beforeEach(() => {
        matchRepository = createMockRepository<RatingMatch>()
        confirmationRepository = createMockRepository<MatchConfirmation>()
        roundRepository = createMockRepository<RatingMatchRound>()
        playerRatingRepository = createMockRepository<PlayerRating>()
        playerStateRepository = createMockRepository<PlayerState>()
        savedRounds = []
        savedConfirmations = []

        Object.defineProperty(matchRepository, "manager", {
            value: {
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
                        }) => Promise<RatingMatch>,
                    ) => {
                        const manager = {
                            create: (
                                _entity: unknown,
                                data: Record<string, unknown>,
                            ) => data,
                            save: vi.fn(
                                async (
                                    entity:
                                        | Record<string, unknown>
                                        | Record<string, unknown>[],
                                ) => {
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
                        }

                        return callback(manager)
                    },
                ),
            },
        })

        const configService = {
            requireGuildConfig: vi.fn().mockResolvedValue({
                guildId: "g1",
                favoriteFormats: ["Bo1"],
                verifyEmoji: "✅",
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
            playerRatingRepository,
            playerStateRepository,
            configService,
            new LeaderboardRatingService(),
            new LeaderboardAggregateService(playerRatingRepository),
            new LeaderboardRoleService(),
            new LeaderboardSeriesService(),
        )
    })

    it("auto-confirms registrant participant on register", async () => {
        await service.registerMatch({
            guildId: "g1",
            channelId: "c1",
            registeredByUserId: "player-a",
            format: MatchFormat.Bo1,
            playerOneUserId: "player-a",
            playerTwoUserId: "player-b",
            rounds: [
                {
                    roundNumber: 1,
                    winnerUserId: "player-a",
                    mapName: "McMinnville OR",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
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
            format: MatchFormat.Bo3,
            playerOneUserId: "player-a",
            playerTwoUserId: "player-b",
            rounds: [
                {
                    roundNumber: 1,
                    winnerUserId: "player-a",
                    mapName: "McMinnville OR",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
                    firstPlayerUserId: "player-a",
                },
                {
                    roundNumber: 2,
                    winnerUserId: "player-a",
                    mapName: "Point Pleasant",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
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
            format: MatchFormat.Bo3,
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
        matchRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const result = await service.finalizeMatch(1)

        expect(result.status).toBe(MatchStatus.Verified)
        expect(playerRatingRepository.save).toHaveBeenCalled()
    })

    it("rejects invalid series rounds", async () => {
        await expect(
            service.registerMatch({
                guildId: "g1",
                channelId: "c1",
                registeredByUserId: "player-a",
                format: MatchFormat.Bo3,
                playerOneUserId: "player-a",
                playerTwoUserId: "player-b",
                rounds: [
                    {
                        roundNumber: 1,
                        winnerUserId: "player-a",
                        mapName: "McMinnville OR",
                        playerOneHeroName: "Achilles",
                        playerTwoHeroName: "Alice",
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
                    format: MatchFormat.Bo1,
                    rating: 1100,
                    verifiedMatchCount: 5,
                },
                {
                    guildId: "g1",
                    discordUserId: "u2",
                    format: MatchFormat.Bo1,
                    rating: 1200,
                    verifiedMatchCount: 3,
                },
                {
                    guildId: "g1",
                    discordUserId: "u3",
                    format: MatchFormat.Bo1,
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
            format: MatchFormat.Bo1,
            rating: 1300,
            verifiedMatchCount: 5,
            lastPlayedAt: new Date(),
        })
        playerRatingRepository.find.mockResolvedValue([
            {
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.Bo1,
                rating: 1000,
            },
        ])
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const mainRating = await service.resetPlayerRating("g1", "u1")

        expect(mainRating).toBe(1000)
        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ rating: 1000 }),
            ]),
        )
    })

    it("sets player rating to custom value across formats", async () => {
        playerRatingRepository.findOne.mockResolvedValue(null)
        playerRatingRepository.find.mockResolvedValue([
            {
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.Bo1,
                rating: 1250,
            },
        ])
        playerRatingRepository.save.mockImplementation((entity) =>
            Promise.resolve(entity),
        )

        const mainRating = await service.resetPlayerRating("g1", "u1", 1250)

        expect(mainRating).toBe(1250)
        expect(playerRatingRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ rating: 1250 }),
            ]),
        )
    })

    it("resets player statistics and clears freeze", async () => {
        playerRatingRepository.findOne.mockResolvedValue({
            id: 1,
            guildId: "g1",
            discordUserId: "u1",
            format: MatchFormat.Bo1,
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
                format: MatchFormat.Bo1,
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
            format: MatchFormat.Bo1,
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
})
