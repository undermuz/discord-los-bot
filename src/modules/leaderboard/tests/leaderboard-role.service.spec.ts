import { describe, expect, it } from "vitest"
import { LeaderboardRoleService } from "../role.service.js"

describe("LeaderboardRoleService", () => {
    const service = new LeaderboardRoleService()

    const config = {
        guildId: "g1",
        favoriteFormats: ["Bo1"],
        verifyEmoji: "✅",
        calibrationRoleId: "cal",
        freezeRoleId: "freeze",
        calibrationMatchThreshold: 10,
        inactivityDays: 60,
        initialRating: 1000,
    }

    const tiers = [
        {
            id: 1,
            guildId: "g1",
            name: "Крылан",
            minRating: 1150,
            maxRating: 1250,
            roleId: "krylan",
        },
        {
            id: 2,
            guildId: "g1",
            name: "Гудини",
            minRating: 1300,
            maxRating: null,
            roleId: "houdini",
        },
    ]

    it("assigns calibration role below threshold", () => {
        const plan = service.buildRoleSyncPlan(
            config,
            tiers,
            { isFrozen: false, totalVerifiedMatches: 2, mainRating: 1200 },
            [],
        )

        expect(plan.addRoleId).toBe("cal")
    })

    it("assigns freeze role when frozen", () => {
        const plan = service.buildRoleSyncPlan(
            config,
            tiers,
            { isFrozen: true, totalVerifiedMatches: 20, mainRating: 1200 },
            ["old"],
        )

        expect(plan.addRoleId).toBe("freeze")
    })

    it("assigns krylan for rating 1200", () => {
        const plan = service.buildRoleSyncPlan(
            config,
            tiers,
            { isFrozen: false, totalVerifiedMatches: 20, mainRating: 1200 },
            [],
        )

        expect(plan.addRoleId).toBe("krylan")
    })

    it("assigns no rank role below 700", () => {
        const plan = service.buildRoleSyncPlan(
            config,
            tiers,
            { isFrozen: false, totalVerifiedMatches: 20, mainRating: 650 },
            [],
        )

        expect(plan.addRoleId).toBeNull()
    })

    it("resolves houdini tier for 1300+", () => {
        expect(service.resolveTier(tiers, 1300)?.roleId).toBe("houdini")
    })
})
