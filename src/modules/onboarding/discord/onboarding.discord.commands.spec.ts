import { beforeEach, describe, expect, it, vi } from "vitest"
import { DISCORD_USER_ERROR_MESSAGE } from "../../../platforms/discord/discord-interaction.util.js"
import {
    createMockChatInputInteraction,
    createMockTextChannel,
} from "../../../../test/helpers/discord.mock.js"
import {
    DiscordCommandHandler,
    DiscordService,
} from "../../../platforms/discord/discord.service.js"
import { OnboardingService } from "../onboarding.service.js"
import { OnboardingDiscordCommands } from "./onboarding.discord.commands.js"

describe("OnboardingDiscordCommands", () => {
    let commands: OnboardingDiscordCommands
    let handlers: Map<string, DiscordCommandHandler>
    let onboardingService: OnboardingService

    beforeEach(() => {
        handlers = new Map()
        onboardingService = {
            createRule: vi.fn(),
            deleteRulesByMessageId: vi.fn(),
        } as unknown as OnboardingService

        const discordService = {
            registerCommand: vi.fn(
                (name: string, handler: DiscordCommandHandler) => {
                    handlers.set(name, handler)
                },
            ),
        } as unknown as DiscordService

        commands = new OnboardingDiscordCommands(
            discordService,
            onboardingService,
        )
        commands.onModuleInit()
    })

    describe("exchange-emoji-to-role", () => {
        it("rejects non-text channels", async () => {
            const interaction = createMockChatInputInteraction(
                "exchange-emoji-to-role",
                {},
                {
                    channel: { isTextBased: () => false },
                },
            )

            await handlers.get("exchange-emoji-to-role")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: "This command can only be used in a text channel",
                }),
            )
        })

        it("returns early when message is not found", async () => {
            const channel = createMockTextChannel({
                fetchMessage: vi.fn().mockRejectedValue(new Error("not found")),
            })
            const interaction = createMockChatInputInteraction(
                "exchange-emoji-to-role",
                {
                    role: { id: "role-1", name: "Member" },
                    emoji: "👍",
                    "message-id": "missing-msg",
                },
                { channel },
            )

            await handlers.get("exchange-emoji-to-role")!(interaction as never)

            expect(onboardingService.createRule).not.toHaveBeenCalled()
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: DISCORD_USER_ERROR_MESSAGE,
                }),
            )
        })

        it("creates rule and sends follow-up when removeAllRoles enabled", async () => {
            const channel = createMockTextChannel()
            const interaction = createMockChatInputInteraction(
                "exchange-emoji-to-role",
                {
                    role: { id: "role-1", name: "Member" },
                    emoji: "👍",
                    "message-id": "msg-1",
                    "remove-all-roles": true,
                },
                { channel },
            )

            vi.mocked(onboardingService.createRule).mockResolvedValue({
                id: 1,
                guildId: "guild-1",
                roleId: "role-1",
                emoji: "👍",
                messageId: "msg-1",
                removeAllRoles: true,
            })

            await handlers.get("exchange-emoji-to-role")!(interaction as never)

            expect(onboardingService.createRule).toHaveBeenCalled()
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining("will lose all roles"),
                }),
            )
        })

        it("returns duplicate rule error", async () => {
            const channel = createMockTextChannel()
            const interaction = createMockChatInputInteraction(
                "exchange-emoji-to-role",
                {
                    role: { id: "role-1", name: "Member" },
                    emoji: "👍",
                    "message-id": "msg-1",
                },
                { channel },
            )

            vi.mocked(onboardingService.createRule).mockRejectedValue(
                new Error("Such rule already exists"),
            )

            await handlers.get("exchange-emoji-to-role")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: DISCORD_USER_ERROR_MESSAGE,
                }),
            )
        })
    })

    describe("cancel-exchange-emoji-to-role", () => {
        it("cancels existing exchange", async () => {
            const interaction = createMockChatInputInteraction(
                "cancel-exchange-emoji-to-role",
                { "message-id": "msg-1" },
            )

            vi.mocked(
                onboardingService.deleteRulesByMessageId,
            ).mockResolvedValue(1)

            await handlers.get("cancel-exchange-emoji-to-role")!(
                interaction as never,
            )

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining("has canceled"),
                }),
            )
        })

        it("returns not found error", async () => {
            const interaction = createMockChatInputInteraction(
                "cancel-exchange-emoji-to-role",
                { "message-id": "msg-1" },
            )

            vi.mocked(
                onboardingService.deleteRulesByMessageId,
            ).mockRejectedValue(
                new Error("No exchange rules found for this message"),
            )

            await handlers.get("cancel-exchange-emoji-to-role")!(
                interaction as never,
            )

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: DISCORD_USER_ERROR_MESSAGE,
                }),
            )
        })
    })
})
