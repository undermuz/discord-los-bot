import { Composer, Context } from "grammy"

export function createRollingComposer(): Composer<Context> {
    const composer = new Composer()

    // TODO: Telegram rolling handlers

    return composer
}
