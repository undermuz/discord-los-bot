import { EventEmitter } from "node:events"
import { vi } from "vitest"

export function createMockDiscordClient(): EventEmitter & {
    login: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    user: { tag: string } | null
    once: EventEmitter["once"]
    on: EventEmitter["on"]
} {
    const emitter = new EventEmitter()
    return Object.assign(emitter, {
        login: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        user: { tag: "TestBot#0001" },
        once: emitter.once.bind(emitter),
        on: emitter.on.bind(emitter),
    })
}

export async function emitAsync(
    client: EventEmitter,
    event: string,
    ...args: unknown[]
): Promise<void> {
    const listeners = client.listeners(event)

    for (const listener of listeners) {
        listener(...args)
    }

    await new Promise((resolve) => setImmediate(resolve))
}

export function createMockGuildMember(roleIds: string[] = []) {
    const roles = roleIds.map((id) => ({ id }))

    const cache = {
        has: (id: string) => roleIds.includes(id),
        map: <T>(fn: (role: { id: string }) => T) => roles.map(fn),
    }

    return {
        roles: {
            cache,
            add: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        },
    }
}

export function createMockReaction(
    overrides: {
        partial?: boolean
        emojiName?: string
        messageId?: string
        guildId?: string
        guild?: {
            id: string
            members: { fetch: ReturnType<typeof vi.fn> }
        } | null
    } = {},
) {
    const {
        partial = false,
        emojiName = "👍",
        messageId = "msg-1",
        guildId = "guild-1",
        guild,
    } = overrides

    const reaction = {
        partial,
        emoji: { name: emojiName },
        message: {
            id: messageId,
            guild: guild ?? {
                id: guildId,
                members: {
                    fetch: vi.fn(),
                },
            },
        },
        fetch: vi.fn().mockImplementation(function fetch(
            this: typeof reaction,
        ) {
            return Promise.resolve({ ...this, partial: false })
        }),
    }

    return reaction
}

export function createMockUser(
    overrides: {
        id?: string
        bot?: boolean
        username?: string
    } = {},
) {
    return {
        id: overrides.id ?? "user-1",
        bot: overrides.bot ?? false,
        username: overrides.username ?? "testuser",
        toString: () => `<@${overrides.id ?? "user-1"}>`,
    }
}

export function createMockTextChannel(
    overrides: {
        id?: string
        fetchMessage?: ReturnType<typeof vi.fn>
    } = {},
) {
    return {
        id: overrides.id ?? "channel-1",
        isTextBased: () => true,
        messages: {
            fetch:
                overrides.fetchMessage ??
                vi.fn().mockResolvedValue({ id: "msg-1" }),
        },
    }
}

export function createMockInteraction(overrides: Record<string, unknown> = {}) {
    const optionsMap = new Map<string, unknown>(
        Object.entries((overrides.options as Record<string, unknown>) ?? {}),
    )

    const interaction = {
        commandName: "test",
        channelId: "channel-1",
        guildId:
            (overrides.guild as { id?: string } | undefined)?.id ?? "guild-1",
        user: createMockUser(),
        channel: createMockTextChannel(),
        guild: { id: "guild-1" },
        replied: false,
        deferred: false,
        reply: vi.fn().mockImplementation(() => {
            interaction.replied = true
            return Promise.resolve(undefined)
        }),
        editReply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        options: {
            getRole: vi.fn((name: string) => optionsMap.get(name)),
            getString: vi.fn((name: string) => optionsMap.get(name)),
            getBoolean: vi.fn((name: string) => optionsMap.get(name)),
            getNumber: vi.fn((name: string) => optionsMap.get(name)),
            getInteger: vi.fn((name: string) => optionsMap.get(name)),
            getUser: vi.fn((name: string) => optionsMap.get(name)),
            getChannel: vi.fn((name: string) => optionsMap.get(name)),
        },
        isChatInputCommand: () => true,
        isAutocomplete: () => false,
        ...overrides,
    }

    return interaction
}

export function createMockChatInputInteraction(
    commandName: string,
    options: Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
) {
    return createMockInteraction({
        commandName,
        options: {
            getRole: vi.fn((name: string, required?: boolean) => {
                const value = options[name]
                if (!value && required) {
                    throw new Error(`Missing required option ${name}`)
                }
                return value
            }),
            getString: vi.fn((name: string, required?: boolean) => {
                const value = options[name]
                if (!value && required) {
                    throw new Error(`Missing required option ${name}`)
                }
                return value
            }),
            getBoolean: vi.fn((name: string) => options[name]),
            getNumber: vi.fn((name: string) => options[name]),
            getInteger: vi.fn((name: string) => options[name]),
            getUser: vi.fn((name: string) => options[name]),
            getChannel: vi.fn((name: string, required?: boolean) => {
                const value = options[name]
                if (!value && required) {
                    throw new Error(`Missing required option ${name}`)
                }
                return value
            }),
        },
        ...overrides,
    })
}
