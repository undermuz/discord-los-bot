import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChannelType } from "discord.js"
import * as randomUtil from "../../../common/utils/random.util.js"
import {
    createMockChatInputInteraction,
    createMockUser,
} from "../../../../test/helpers/discord.mock.js"
import {
    DiscordCommandHandler,
    DiscordService,
} from "../../../platforms/discord/discord.service.js"
import { RollingService } from "../rolling.service.js"
import { RollingDiscordCommands } from "./rolling.discord.commands.js"
import { RollingDiscordPresenter } from "./rolling.discord.presenter.js"

describe("RollingDiscordCommands", () => {
    let handlers: Map<string, DiscordCommandHandler>
    let rollingService: RollingService
    let presenter: RollingDiscordPresenter

    beforeEach(() => {
        handlers = new Map()
        rollingService = {
            getReactionAsset: vi.fn(),
        } as unknown as RollingService
        presenter = {
            renderMultiUserRoll: vi.fn().mockResolvedValue(undefined),
        } as unknown as RollingDiscordPresenter

        const discordService = {
            registerCommand: vi.fn(
                (name: string, handler: DiscordCommandHandler) => {
                    handlers.set(name, handler)
                },
            ),
        } as unknown as DiscordService

        const commands = new RollingDiscordCommands(
            discordService,
            rollingService,
            presenter,
        )
        commands.onModuleInit()
    })

    describe("roll", () => {
        it("replies, edits and sends meme follow-up", async () => {
            vi.spyOn(randomUtil, "randomIntFromInterval").mockResolvedValue(100)
            vi.mocked(rollingService.getReactionAsset).mockReturnValue({
                value: 100,
                url: "https://example.com/success.jpg",
            })

            const interaction = createMockChatInputInteraction(
                "roll",
                {},
                {
                    user: createMockUser({ id: "u1" }),
                },
            )

            await handlers.get("roll")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalled()
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.stringContaining("и выбрасывает 100"),
            )
            expect(interaction.followUp).toHaveBeenCalledWith(
                "https://example.com/success.jpg",
            )
        })
    })

    describe("rolls", () => {
        it("returns error when less than 2 users", async () => {
            const interaction = createMockChatInputInteraction("rolls", {
                member_1: createMockUser({ id: "u1" }),
            })

            await handlers.get("rolls")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                "Ошибка: Минимум игроков 2",
            )
            expect(presenter.renderMultiUserRoll).not.toHaveBeenCalled()
        })

        it("delegates to presenter for valid user list", async () => {
            const u1 = createMockUser({ id: "u1" })
            const u2 = createMockUser({ id: "u2" })
            const interaction = createMockChatInputInteraction("rolls", {
                member_1: u1,
                member_2: u2,
            })

            await handlers.get("rolls")!(interaction as never)

            expect(presenter.renderMultiUserRoll).toHaveBeenCalledWith(
                interaction,
                [u1, u2],
            )
        })
    })

    describe("roll-channel", () => {
        it("returns error for non-voice channel", async () => {
            const interaction = createMockChatInputInteraction("roll-channel", {
                roll_channel: {
                    type: ChannelType.GuildText,
                    members: new Map(),
                },
            })

            await handlers.get("roll-channel")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                "Ошибка: Канал должен быть голосовым",
            )
        })

        it("excludes members and delegates to presenter", async () => {
            const excluded = createMockUser({ id: "u3" })
            const u1 = createMockUser({ id: "u1" })
            const u2 = createMockUser({ id: "u2" })

            const members = new Map([
                ["m1", { user: u1 }],
                ["m2", { user: u2 }],
                ["m3", { user: excluded }],
            ])

            const interaction = createMockChatInputInteraction("roll-channel", {
                roll_channel: {
                    type: ChannelType.GuildVoice,
                    members,
                },
                exclude_member_1: excluded,
            })

            await handlers.get("roll-channel")!(interaction as never)

            expect(presenter.renderMultiUserRoll).toHaveBeenCalledWith(
                interaction,
                [u1, u2],
            )
        })

        it("returns error when less than 2 members remain", async () => {
            const u1 = createMockUser({ id: "u1" })
            const members = new Map([["m1", { user: u1 }]])

            const interaction = createMockChatInputInteraction("roll-channel", {
                roll_channel: {
                    type: ChannelType.GuildVoice,
                    members,
                },
            })

            await handlers.get("roll-channel")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                "Ошибка: Минимум игроков 2",
            )
        })

        it("returns error when more than 25 members remain", async () => {
            const members = new Map(
                Array.from({ length: 26 }, (_, index) => [
                    `m${index}`,
                    { user: createMockUser({ id: `u${index}` }) },
                ]),
            )

            const interaction = createMockChatInputInteraction("roll-channel", {
                roll_channel: {
                    type: ChannelType.GuildVoice,
                    members,
                },
            })

            await handlers.get("roll-channel")!(interaction as never)

            expect(interaction.reply).toHaveBeenCalledWith(
                "Ошибка: Максимум игроков 25",
            )
        })
    })
})
