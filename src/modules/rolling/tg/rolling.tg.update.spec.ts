import { describe, expect, it } from "vitest"
import { Composer } from "grammy"
import { createRollingComposer } from "./rolling.tg.update.js"

describe("createRollingComposer", () => {
    it("returns a grammy Composer instance", () => {
        const composer = createRollingComposer()
        expect(composer).toBeInstanceOf(Composer)
    })
})
