import { vi } from "vitest"
import { Repository } from "typeorm"

export function createMockRepository<T extends object>(): Repository<T> {
    return {
        findOne: vi.fn(),
        find: vi.fn(),
        save: vi.fn(),
        create: vi.fn((entity) => entity),
        delete: vi.fn(),
    } as unknown as Repository<T>
}
