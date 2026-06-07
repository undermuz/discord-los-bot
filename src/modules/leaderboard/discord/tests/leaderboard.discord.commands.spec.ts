import { beforeEach, describe, expect, it, vi } from "vitest"
import { DISCORD_USER_ERROR_MESSAGE } from "../../../../platforms/discord/discord-interaction.util.js"
import {
    createMockChatInputInteraction,
    createMockUser,
} from "../../../../../test/helpers/discord.mock.js"
import {
    DiscordCommandHandler,
    DiscordService,
} from "../../../../platforms/discord/discord.service.js"
import { LeaderboardConfigService } from "../../config.service.js"
import { LeaderboardService } from "../../leaderboard.service.js"
import { MatchFormat } from "../../types.js"
import { LeaderboardDiscordCommands } from "../commands.js"
import { LeaderboardDiscordPresenter } from "../presenter.js"
import { LeaderboardDiscordRoles } from "../roles.js"

describe("LeaderboardDiscordCommands", () => {
    let handlers: Map<string, DiscordCommandHandler>
    let leaderboardService: LeaderboardService
    let configService: LeaderboardConfigService

    beforeEach(() => {
        handlers = new Map()
        leaderboardService = {
            registerMatch: vi.fn().mockResolvedValue({ id: 1 }),
            getMatchDisplayData: vi.fn().mockResolvedValue({
                match: {
                    id: 1,
                    format: MatchFormat.Bo1,
                    winnerUserId: "w1",
                    loserUserId: "l1",
                    winnerScore: 1,
                    loserScore: 0,
                    status: "pending",
                },
                config: { verifyEmoji: "✅" },
                winnerRating: 1000,
                loserRating: 1000,
                confirmations: [],
                pendingUsers: ["l1"],
                rounds: [
                    {
                        roundNumber: 1,
                        mapName: "McMinnville OR",
                        winnerUserId: "w1",
                        loserUserId: "l1",
                    },
                ],
            }),
            attachMessageId: vi.fn(),
            finalizeMatch: vi.fn(),
            getTopPlayers: vi.fn().mockResolvedValue([
                {
                    discordUserId: "w1",
                    mainRating: 1200,
                    totalVerifiedMatches: 10,
                    isFrozen: false,
                },
            ]),
        } as unknown as LeaderboardService

        configService = {
            getOrCreateGuildConfig: vi.fn().mockResolvedValue({
                guildId: "g1",
                favoriteFormats: ["Bo1", "Bo3"],
                verifyEmoji: "✅",
                calibrationRoleId: "role-cal",
                freezeRoleId: "role-freeze",
                calibrationMatchThreshold: 10,
                inactivityDays: 60,
                initialRating: 1000,
            }),
            getTiers: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    guildId: "g1",
                    name: "Ангел",
                    minRating: 700,
                    maxRating: 750,
                    roleId: "role-angel",
                },
            ]),
        } as unknown as LeaderboardConfigService

        const discordService = {
            registerCommand: vi.fn(
                (name: string, handler: DiscordCommandHandler) => {
                    handlers.set(name, handler)
                },
            ),
            registerAutocomplete: vi.fn(),
        } as unknown as DiscordService

        const commands = new LeaderboardDiscordCommands(
            discordService,
            leaderboardService,
            configService,
            { syncMembers: vi.fn() } as unknown as LeaderboardDiscordRoles,
            new LeaderboardDiscordPresenter(leaderboardService),
        )
        commands.onModuleInit()
    })

    it("registers match and posts verification message", async () => {
        const playerOne = createMockUser({ id: "w1" })
        const playerTwo = createMockUser({ id: "l1" })
        const send = vi.fn().mockResolvedValue({
            id: "msg-1",
            url: "https://discord.com/message/1",
            react: vi.fn(),
        })
        const interaction = createMockChatInputInteraction(
            "new-rating-match",
            {
                format: MatchFormat.Bo1,
                player_1: playerOne,
                player_2: playerTwo,
                map_1: "McMinnville OR",
                round_1_winner: playerOne,
                p1_hero_1: "Achilles",
                p2_hero_1: "Alice",
                p1_first_rounds: "1",
            },
            {
                user: playerOne,
                channel: {
                    id: "c1",
                    isTextBased: () => true,
                    send,
                },
                guild: { id: "g1" },
            },
        )

        await handlers.get("new-rating-match")!(interaction as never)

        expect(leaderboardService.registerMatch).toHaveBeenCalledWith(
            expect.objectContaining({
                playerOneUserId: "w1",
                playerTwoUserId: "l1",
                rounds: [
                    {
                        roundNumber: 1,
                        winnerUserId: "w1",
                        mapName: "McMinnville OR",
                        playerOneHeroName: "Achilles",
                        playerTwoHeroName: "Alice",
                        firstPlayerUserId: "w1",
                    },
                ],
            }),
        )
        expect(send).toHaveBeenCalled()
        expect(interaction.reply).toHaveBeenCalled()
    })

    it("rejects invalid series via service error", async () => {
        vi.mocked(leaderboardService.registerMatch).mockRejectedValue(
            new Error("Series score must reach 2 wins for Bo3"),
        )

        const interaction = createMockChatInputInteraction(
            "new-rating-match",
            {
                format: MatchFormat.Bo3,
                player_1: createMockUser({ id: "u1" }),
                player_2: createMockUser({ id: "u2" }),
                map_1: "McMinnville OR",
                round_1_winner: createMockUser({ id: "u1" }),
                p1_hero_1: "Achilles",
                p2_hero_1: "Alice",
            },
            {
                channel: {
                    id: "c1",
                    isTextBased: () => true,
                    send: vi.fn(),
                },
                guild: { id: "g1" },
            },
        )

        await handlers.get("new-rating-match")!(interaction as never)

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: DISCORD_USER_ERROR_MESSAGE,
            }),
        )
    })

    it("shows top players leaderboard", async () => {
        const interaction = createMockChatInputInteraction(
            "leaderboard-top",
            { size: 10 },
            { guild: { id: "g1" } },
        )

        await handlers.get("leaderboard-top")!(interaction as never)

        expect(leaderboardService.getTopPlayers).toHaveBeenCalledWith("g1", 10)
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining("**Топ-10 рейтинга**"),
            }),
        )
    })

    it("shows guild config", async () => {
        const interaction = createMockChatInputInteraction(
            "leaderboard-config",
            {},
            { guild: { id: "g1" } },
        )

        await handlers.get("leaderboard-config")!(interaction as never)

        expect(configService.getOrCreateGuildConfig).toHaveBeenCalledWith("g1")
        expect(configService.getTiers).toHaveBeenCalledWith("g1")
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    "**Настройки рейтинга сервера**",
                ),
                ephemeral: true,
            }),
        )
    })

    it("shows welcome guide in channel", async () => {
        const interaction = createMockChatInputInteraction(
            "leaderboard-welcome",
            {},
            { guild: { id: "g1" } },
        )

        await handlers.get("leaderboard-welcome")!(interaction as never)

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    "**Настройка (администратор)**",
                ),
            }),
        )
    })
})
