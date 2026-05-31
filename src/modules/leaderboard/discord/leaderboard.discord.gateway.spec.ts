import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    createMockDiscordClient,
    createMockGuildMember,
    createMockReaction,
    createMockUser,
    emitAsync,
} from "../../../../test/helpers/discord.mock.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { LeaderboardConfigService } from "../leaderboard-config.service.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchStatus } from "../leaderboard.types.js"
import { LeaderboardDiscordGateway } from "./leaderboard.discord.gateway.js"
import { LeaderboardDiscordPresenter } from "./leaderboard.discord.presenter.js"
import { LeaderboardDiscordRoles } from "./leaderboard.discord.roles.js"

describe("LeaderboardDiscordGateway", () => {
    let gateway: LeaderboardDiscordGateway
    let client: ReturnType<typeof createMockDiscordClient>
    let leaderboardService: LeaderboardService
    let rolesAdapter: LeaderboardDiscordRoles
    let presenter: LeaderboardDiscordPresenter

    beforeEach(() => {
        client = createMockDiscordClient()
        leaderboardService = {
            findMatchByMessage: vi.fn(),
            confirmMatch: vi.fn(),
        } as unknown as LeaderboardService

        const configService = {
            getGuildConfig: vi.fn().mockResolvedValue({
                verifyEmoji: "✅",
            }),
        } as unknown as LeaderboardConfigService

        rolesAdapter = {
            syncMembers: vi.fn(),
        } as unknown as LeaderboardDiscordRoles

        presenter = {
            refreshMatchMessage: vi.fn(),
        } as unknown as LeaderboardDiscordPresenter

        gateway = new LeaderboardDiscordGateway(
            { client } as unknown as DiscordService,
            leaderboardService,
            configService,
            rolesAdapter,
            presenter,
        )
        gateway.onModuleInit()
    })

    it("verifies match and syncs roles on valid reaction", async () => {
        const member = createMockGuildMember([])
        const guild = {
            id: "g1",
            members: { fetch: vi.fn().mockResolvedValue(member) },
        }
        const reaction = createMockReaction({ guild, emojiName: "✅" })
        const user = createMockUser({ id: "l1" })

        vi.mocked(leaderboardService.findMatchByMessage).mockResolvedValue({
            id: 1,
            guildId: "g1",
            messageId: "msg-1",
        } as never)
        vi.mocked(leaderboardService.confirmMatch).mockResolvedValue({
            id: 1,
            status: MatchStatus.Verified,
            winnerUserId: "w1",
            loserUserId: "l1",
        } as never)

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(leaderboardService.confirmMatch).toHaveBeenCalledWith(
            "g1",
            reaction.message.id,
            "l1",
        )
        expect(presenter.refreshMatchMessage).toHaveBeenCalledWith(
            reaction.message,
            1,
        )
        expect(rolesAdapter.syncMembers).toHaveBeenCalled()
    })

    it("updates message when match is partially confirmed", async () => {
        const reaction = createMockReaction({ guild: { id: "g1" }, emojiName: "✅" })
        const user = createMockUser({ id: "w1" })

        vi.mocked(leaderboardService.findMatchByMessage).mockResolvedValue({
            id: 1,
            guildId: "g1",
            messageId: "msg-1",
        } as never)
        vi.mocked(leaderboardService.confirmMatch).mockResolvedValue({
            id: 1,
            status: MatchStatus.Pending,
        } as never)

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(presenter.refreshMatchMessage).toHaveBeenCalledWith(
            reaction.message,
            1,
        )
        expect(rolesAdapter.syncMembers).not.toHaveBeenCalled()
    })

    it("ignores reactions with wrong emoji", async () => {
        const reaction = createMockReaction({ emojiName: "❌" })
        const user = createMockUser({ id: "l1" })

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(leaderboardService.confirmMatch).not.toHaveBeenCalled()
    })
})
