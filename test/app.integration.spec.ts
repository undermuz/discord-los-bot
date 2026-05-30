import { Test, TestingModule } from "@nestjs/testing"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { createMockDiscordClient } from "./helpers/discord.mock.js"
import { AppModule } from "../src/app.module.js"
import { OnboardingService } from "../src/modules/onboarding/onboarding.service.js"
import { RollingService } from "../src/modules/rolling/rolling.service.js"
import { DiscordService } from "../src/platforms/discord/discord.service.js"
import { TelegramService } from "../src/platforms/telegram/telegram.service.js"

describe("AppModule (integration)", () => {
    beforeAll(() => {
        process.env.DB_PATH = ":memory:"
        process.env.DISCORD_TOKEN = ""
        process.env.TELEGRAM_BOT_TOKEN = ""
    })

    it("compiles and resolves core services with mocked platforms", async () => {
        const mockClient = createMockDiscordClient()

        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DiscordService)
            .useValue({
                client: mockClient,
                registerCommand: vi.fn(),
                onModuleInit: vi.fn(),
                onApplicationBootstrap: vi.fn(),
                onModuleDestroy: vi.fn(),
            })
            .overrideProvider(TelegramService)
            .useValue({
                registerUpdate: vi.fn(),
                onModuleInit: vi.fn(),
                onApplicationBootstrap: vi.fn(),
                onModuleDestroy: vi.fn(),
            })
            .compile()

        expect(moduleRef.get(OnboardingService)).toBeDefined()
        expect(moduleRef.get(RollingService)).toBeDefined()
    })
})
