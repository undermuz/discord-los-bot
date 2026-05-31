import { describe, expect, it } from "vitest"
import { Composer } from "grammy"
import { createLeaderboardComposer } from "./leaderboard.tg.update.js"

describe("createLeaderboardComposer", () => {
    it("returns a grammy Composer instance", () => {
        expect(createLeaderboardComposer()).toBeInstanceOf(Composer)
    })
})
