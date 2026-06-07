import { beforeEach, describe, expect, it } from "vitest"
import { createMockRepository } from "../../../../test/helpers/typeorm.mock.js"
import { PlayerRating } from "../../../database/entities/player-rating.entity.js"
import { LeaderboardAggregateService } from "../aggregate.service.js"
import { MatchFormat } from "../types.js"

describe("LeaderboardAggregateService", () => {
    let service: LeaderboardAggregateService
    let repository: ReturnType<typeof createMockRepository<PlayerRating>>

    beforeEach(() => {
        repository = createMockRepository<PlayerRating>()
        service = new LeaderboardAggregateService(repository)
    })

    it("calculates average using initial rating for missing formats", async () => {
        repository.find.mockResolvedValue([
            {
                format: MatchFormat.Bo1,
                rating: 1100,
            },
        ])

        const mainRating = await service.getMainRating("g1", "u1", {
            guildId: "g1",
            favoriteFormats: [MatchFormat.Bo1, MatchFormat.Bo3],
            verifyEmoji: "✅",
            calibrationRoleId: null,
            freezeRoleId: null,
            calibrationMatchThreshold: 10,
            inactivityDays: 60,
            initialRating: 1000,
        })

        expect(mainRating).toBe(1050)
    })

    it("keeps hundredths in main rating average", async () => {
        repository.find.mockResolvedValue([
            {
                format: "Bo1",
                rating: 1000.25,
            },
            {
                format: "Bo3",
                rating: 1000.75,
            },
        ])

        const mainRating = await service.getMainRating("g1", "u1", {
            guildId: "g1",
            favoriteFormats: ["Bo1", "Bo3"],
            verifyEmoji: "✅",
            calibrationRoleId: "cal",
            freezeRoleId: "freeze",
            calibrationMatchThreshold: 10,
            inactivityDays: 60,
            initialRating: 1000,
        })

        expect(mainRating).toBe(1000.5)
    })

    it("returns initial rating when no favorite formats configured", async () => {
        const mainRating = await service.getMainRating("g1", "u1", {
            guildId: "g1",
            favoriteFormats: [],
            verifyEmoji: "✅",
            calibrationRoleId: null,
            freezeRoleId: null,
            calibrationMatchThreshold: 10,
            inactivityDays: 60,
            initialRating: 1000,
        })

        expect(mainRating).toBe(1000)
    })

    it("sums verified match counts across formats", async () => {
        repository.find.mockResolvedValue([
            { verifiedMatchCount: 3 },
            { verifiedMatchCount: 7 },
        ] as PlayerRating[])

        await expect(service.getTotalVerifiedMatches("g1", "u1")).resolves.toBe(
            10,
        )
    })
})
