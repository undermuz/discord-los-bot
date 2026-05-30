import { ConfigService } from "@nestjs/config"
import { vi } from "vitest"

export function createMockConfigService(
    values: Record<string, unknown> = {},
): ConfigService {
    return {
        get: vi.fn((key: string) => values[key]),
    } as unknown as ConfigService
}
