import { beforeEach, describe, expect, it, vi } from "vitest"
import { LeaderboardGuildConfig } from "../../../database/entities/leaderboard-guild-config.entity.js"
import { PlayerRating } from "../../../database/entities/player-rating.entity.js"
import { createMockRepository } from "../../../../test/helpers/typeorm.mock.js"
import { LeaderboardInactivityService } from "../inactivity.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchFormat } from "../types.js"

describe("LeaderboardInactivityService", () => {
    let service: LeaderboardInactivityService
    let playerRatingRepository: ReturnType<
        typeof createMockRepository<PlayerRating>
    > & {
        createQueryBuilder: ReturnType<typeof vi.fn>
    }
    let leaderboardService: LeaderboardService

    beforeEach(() => {
        playerRatingRepository = Object.assign(
            createMockRepository<PlayerRating>(),
            {
                createQueryBuilder: vi.fn(),
            },
        )
        leaderboardService = {
            freezeInactivePlayer: vi.fn(),
        } as unknown as LeaderboardService

        service = new LeaderboardInactivityService(
            createMockRepository<LeaderboardGuildConfig>(),
            playerRatingRepository,
            leaderboardService,
        )
    })

    it("freezes player inactive in favorite formats", async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 90)

        playerRatingRepository.createQueryBuilder.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            getRawMany: vi.fn().mockResolvedValue([{ discordUserId: "u1" }]),
        })
        playerRatingRepository.find.mockResolvedValue([
            {
                guildId: "g1",
                discordUserId: "u1",
                format: MatchFormat.Bo1,
                lastPlayedAt: oldDate,
            },
        ])

        await service.checkGuildInactivity({
            guildId: "g1",
            favoriteFormats: [MatchFormat.Bo1],
            verifyEmoji: "✅",
            calibrationRoleId: null,
            freezeRoleId: null,
            calibrationMatchThreshold: 10,
            inactivityDays: 60,
            initialRating: 1000,
        })

        expect(leaderboardService.freezeInactivePlayer).toHaveBeenCalledWith(
            "g1",
            "u1",
            1000,
        )
    })
})
