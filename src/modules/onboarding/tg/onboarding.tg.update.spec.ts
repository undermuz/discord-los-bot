import { describe, expect, it } from "vitest"
import { Composer } from "grammy"
import { createOnboardingComposer } from "./onboarding.tg.update.js"

describe("createOnboardingComposer", () => {
    it("returns a grammy Composer instance", () => {
        const composer = createOnboardingComposer()
        expect(composer).toBeInstanceOf(Composer)
    })
})
