import { beforeEach, describe, expect, it, vi } from "vitest"
import { Composer } from "grammy"
import { createMockConfigService } from "../../../test/helpers/config.mock.js"
import { TelegramService } from "./telegram.service.js"

const botStart = vi.fn().mockResolvedValue(undefined)
const botStop = vi.fn().mockResolvedValue(undefined)
const botUse = vi.fn()

vi.mock("grammy", () => {
    class MockComposer {
        use = vi.fn()
    }

    class MockBot {
        use = botUse
        start = botStart
        stop = botStop
    }

    return {
        Bot: MockBot,
        Composer: MockComposer,
    }
})

describe("TelegramService", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("warns and skips bot creation without token", () => {
        const service = new TelegramService(createMockConfigService({}))
        const warnSpy = vi.spyOn(service["logger"], "warn")

        service.onModuleInit()
        service.onApplicationBootstrap()

        expect(warnSpy).toHaveBeenCalled()
        expect(botStart).not.toHaveBeenCalled()
    })

    it("creates bot and registers composable updates", () => {
        const service = new TelegramService(
            createMockConfigService({ "app.telegramBotToken": "tg-token" }),
        )

        service.onModuleInit()
        service.registerUpdate(new Composer())

        expect(botUse).toHaveBeenCalled()
    })

    it("starts bot on application bootstrap", () => {
        const service = new TelegramService(
            createMockConfigService({ "app.telegramBotToken": "tg-token" }),
        )

        service.onModuleInit()
        service.onApplicationBootstrap()

        expect(botStart).toHaveBeenCalled()
    })

    it("stops bot on module destroy", async () => {
        const service = new TelegramService(
            createMockConfigService({ "app.telegramBotToken": "tg-token" }),
        )

        service.onModuleInit()
        await service.onModuleDestroy()

        expect(botStop).toHaveBeenCalled()
    })
})
