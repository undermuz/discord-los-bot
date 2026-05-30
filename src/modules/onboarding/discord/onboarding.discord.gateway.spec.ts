import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    createMockDiscordClient,
    createMockGuildMember,
    createMockReaction,
    createMockUser,
    emitAsync,
} from "../../../../test/helpers/discord.mock.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { OnboardingService } from "../onboarding.service.js"
import { OnboardingDiscordGateway } from "./onboarding.discord.gateway.js"

describe("OnboardingDiscordGateway", () => {
    let gateway: OnboardingDiscordGateway
    let discordService: DiscordService
    let onboardingService: OnboardingService
    let client: ReturnType<typeof createMockDiscordClient>

    beforeEach(() => {
        client = createMockDiscordClient()
        discordService = {
            client,
        } as unknown as DiscordService

        onboardingService = {
            findRule: vi.fn(),
            shouldGrantRole: vi.fn(),
            getRoleRemovalPlan: vi.fn(),
        } as unknown as OnboardingService

        gateway = new OnboardingDiscordGateway(
            discordService,
            onboardingService,
        )
        gateway.onModuleInit()
    })

    it("ignores bot users on reaction add", async () => {
        const reaction = createMockReaction()
        const user = createMockUser({ bot: true })

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(onboardingService.findRule).not.toHaveBeenCalled()
    })

    it("adds role when rule exists and member lacks role", async () => {
        const member = createMockGuildMember([])
        const guild = {
            id: "guild-1",
            members: { fetch: vi.fn().mockResolvedValue(member) },
        }
        const reaction = createMockReaction({ guild })
        const user = createMockUser({ id: "user-1" })

        vi.mocked(onboardingService.findRule).mockResolvedValue({
            id: 1,
            guildId: "guild-1",
            roleId: "role-1",
            emoji: "👍",
            messageId: "msg-1",
            removeAllRoles: false,
        })
        vi.mocked(onboardingService.shouldGrantRole).mockReturnValue(true)

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(member.roles.add).toHaveBeenCalledWith("role-1")
    })

    it("skips add when member already has role", async () => {
        const member = createMockGuildMember(["role-1"])
        const guild = {
            id: "guild-1",
            members: { fetch: vi.fn().mockResolvedValue(member) },
        }
        const reaction = createMockReaction({ guild })
        const user = createMockUser({ id: "user-1" })

        vi.mocked(onboardingService.findRule).mockResolvedValue({
            id: 1,
            guildId: "guild-1",
            roleId: "role-1",
            emoji: "👍",
            messageId: "msg-1",
            removeAllRoles: false,
        })
        vi.mocked(onboardingService.shouldGrantRole).mockReturnValue(false)

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(member.roles.add).not.toHaveBeenCalled()
    })

    it("removes mapped role on reaction remove", async () => {
        const member = createMockGuildMember(["role-1", "role-2"])
        const guild = {
            id: "guild-1",
            members: { fetch: vi.fn().mockResolvedValue(member) },
        }
        const reaction = createMockReaction({ guild })
        const user = createMockUser({ id: "user-1" })

        vi.mocked(onboardingService.findRule).mockResolvedValue({
            id: 1,
            guildId: "guild-1",
            roleId: "role-1",
            emoji: "👍",
            messageId: "msg-1",
            removeAllRoles: false,
        })
        vi.mocked(onboardingService.getRoleRemovalPlan).mockReturnValue([
            "role-1",
        ])

        await emitAsync(client, "messageReactionRemove", reaction, user)

        expect(member.roles.remove).toHaveBeenCalledWith(["role-1"])
    })

    it("removes all roles when removeAllRoles is enabled", async () => {
        const member = createMockGuildMember(["role-1", "role-2"])
        const guild = {
            id: "guild-1",
            members: { fetch: vi.fn().mockResolvedValue(member) },
        }
        const reaction = createMockReaction({ guild })
        const user = createMockUser({ id: "user-1" })

        vi.mocked(onboardingService.findRule).mockResolvedValue({
            id: 1,
            guildId: "guild-1",
            roleId: "role-1",
            emoji: "👍",
            messageId: "msg-1",
            removeAllRoles: true,
        })
        vi.mocked(onboardingService.getRoleRemovalPlan).mockReturnValue([
            "role-1",
            "role-2",
        ])

        await emitAsync(client, "messageReactionRemove", reaction, user)

        expect(member.roles.remove).toHaveBeenCalledWith(["role-1", "role-2"])
    })

    it("fetches partial reactions before processing", async () => {
        const reaction = createMockReaction({ partial: true, guild: null })
        reaction.message.guild = {
            id: "guild-1",
            members: {
                fetch: vi.fn().mockResolvedValue(createMockGuildMember([])),
            },
        }
        const user = createMockUser({ id: "user-1" })

        vi.mocked(onboardingService.findRule).mockResolvedValue(null)

        await emitAsync(client, "messageReactionAdd", reaction, user)

        expect(reaction.fetch).toHaveBeenCalled()
    })
})
