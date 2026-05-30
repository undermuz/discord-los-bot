import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockUser } from "../../../../test/helpers/discord.mock.js"
import { RollingService } from "../rolling.service.js"
import { RollingStatisticsService } from "../rolling-statistics.service.js"
import { RollResult } from "../rolling.types.js"
import { RollingDiscordPresenter } from "./rolling.discord.presenter.js"

describe("RollingDiscordPresenter", () => {
    let presenter: RollingDiscordPresenter
    let rollingService: RollingService
    let statisticsService: RollingStatisticsService

    beforeEach(() => {
        rollingService = {
            rollParticipants: vi.fn(),
            resolveOutcome: vi.fn(),
            getReactionAsset: vi.fn(),
            pickSpecialFlag: vi.fn(),
        } as unknown as RollingService

        statisticsService = {
            dropFromLosers: vi.fn(),
            dropFromWinners: vi.fn(),
            processLoser: vi.fn().mockReturnValue(2),
            processWinner: vi.fn().mockReturnValue(1),
            getPostfixText: vi.fn().mockReturnValue(" streak"),
            getStatistics: vi.fn().mockReturnValue({ winners: {}, losers: {} }),
        } as unknown as RollingStatisticsService

        presenter = new RollingDiscordPresenter(
            rollingService,
            statisticsService,
        )
    })

    it("renders progressive roll results and meme follow-ups", async () => {
        const u1 = createMockUser({ id: "u1" })
        const u2 = createMockUser({ id: "u2" })

        const rawResults: RollResult[] = [
            { participant: { id: "u1", displayName: "<@u1>" }, value: 10 },
            { participant: { id: "u2", displayName: "<@u2>" }, value: 100 },
        ]

        vi.mocked(rollingService.rollParticipants).mockResolvedValue(rawResults)
        vi.mocked(rollingService.resolveOutcome).mockReturnValue({
            results: rawResults,
            winners: [rawResults[1]],
            losers: [rawResults[0]],
            minScore: 10,
            maxScore: 100,
        })
        vi.mocked(rollingService.pickSpecialFlag).mockResolvedValue(null)
        vi.mocked(rollingService.getReactionAsset).mockImplementation(
            (value) =>
                value === 100
                    ? { value: 100, url: "https://example.com/success.jpg" }
                    : null,
        )

        const interaction = {
            channelId: "ch1",
            reply: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
            followUp: vi.fn().mockResolvedValue(undefined),
        }

        await presenter.renderMultiUserRoll(interaction as never, [u1, u2])

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining("🎲🎲🎲"),
        )
        expect(interaction.editReply).toHaveBeenCalled()
        expect(statisticsService.processLoser).toHaveBeenCalledWith("ch1", "u1")
        expect(statisticsService.processWinner).toHaveBeenCalledWith(
            "ch1",
            "u2",
        )
        expect(interaction.followUp).toHaveBeenCalledWith({
            content: "<@u2>",
            files: ["https://example.com/success.jpg"],
        })
    })

    it("shows nobody won/lost messages when outcome has no winners or losers", async () => {
        const u1 = createMockUser({ id: "u1" })
        const u2 = createMockUser({ id: "u2" })
        const rawResults: RollResult[] = [
            { participant: { id: "u1", displayName: "<@u1>" }, value: 50 },
            { participant: { id: "u2", displayName: "<@u2>" }, value: 50 },
        ]

        vi.mocked(rollingService.rollParticipants).mockResolvedValue(rawResults)
        vi.mocked(rollingService.resolveOutcome).mockReturnValue({
            results: rawResults,
            winners: [],
            losers: [],
            minScore: -1,
            maxScore: -1,
        })
        vi.mocked(rollingService.pickSpecialFlag).mockResolvedValue(null)
        vi.mocked(rollingService.getReactionAsset).mockReturnValue(null)

        const interaction = {
            channelId: "ch1",
            reply: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
            followUp: vi.fn().mockResolvedValue(undefined),
        }

        await presenter.renderMultiUserRoll(interaction as never, [u1, u2])

        const lastEdit = vi
            .mocked(interaction.editReply)
            .mock.calls.at(-1)?.[0] as string
        expect(lastEdit).toContain("Никто не проиграл")
        expect(lastEdit).toContain("Никто не выиграл")
    })
})
