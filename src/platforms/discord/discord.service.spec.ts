import { beforeEach, describe, expect, it, vi } from "vitest"
import { DISCORD_USER_ERROR_MESSAGE } from "./discord-interaction.util.js"
import { createMockConfigService } from "../../../test/helpers/config.mock.js"
import {
    createMockChatInputInteraction,
    createMockDiscordClient,
} from "../../../test/helpers/discord.mock.js"
import { DiscordCommandHandler, DiscordService } from "./discord.service.js"

describe("DiscordService", () => {
    let service: DiscordService
    let client: ReturnType<typeof createMockDiscordClient>

    beforeEach(() => {
        service = new DiscordService(
            createMockConfigService({ "app.discordToken": "test-token" }),
        )
        client = createMockDiscordClient()
        Object.defineProperty(service, "client", { value: client })
        service.onModuleInit()
    })

    it("registers and routes slash commands", async () => {
        const handler = vi.fn().mockResolvedValue(undefined)
        service.registerCommand("ping", handler)

        const interaction = createMockChatInputInteraction("ping")
        client.emit("interactionCreate", interaction)

        await vi.waitFor(() => {
            expect(handler).toHaveBeenCalledWith(interaction)
        })
    })

    it("ignores unknown commands", async () => {
        const interaction = createMockChatInputInteraction("unknown")
        client.emit("interactionCreate", interaction)

        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(interaction.reply).not.toHaveBeenCalled()
    })

    it("replies with error when handler throws", async () => {
        service.registerCommand("fail", () => {
            throw new Error("boom")
        })

        const interaction = createMockChatInputInteraction("fail")
        client.emit("interactionCreate", interaction)

        await vi.waitFor(() => {
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: DISCORD_USER_ERROR_MESSAGE }),
            )
        })
    })

    it("uses followUp when interaction already replied", async () => {
        const handler: DiscordCommandHandler = () => {
            throw new Error("late boom")
        }
        service.registerCommand("late-fail", handler)

        const interaction = createMockChatInputInteraction(
            "late-fail",
            {},
            {
                replied: true,
            },
        )
        client.emit("interactionCreate", interaction)

        await vi.waitFor(() => {
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: DISCORD_USER_ERROR_MESSAGE }),
            )
        })
    })

    it("does not login without token", () => {
        const noTokenService = new DiscordService(createMockConfigService({}))
        const noTokenClient = createMockDiscordClient()
        Object.defineProperty(noTokenService, "client", {
            value: noTokenClient,
        })

        noTokenService.onApplicationBootstrap()

        expect(noTokenClient.login).not.toHaveBeenCalled()
    })

    it("logs in on application bootstrap when token exists", () => {
        service.onApplicationBootstrap()
        expect(client.login).toHaveBeenCalledWith("test-token")
    })
})
