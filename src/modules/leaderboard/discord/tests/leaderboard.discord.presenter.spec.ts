import { describe, expect, it } from "vitest"
import { MatchStatus } from "../../types.js"
import { LeaderboardDiscordPresenter } from "../presenter.js"

describe("LeaderboardDiscordPresenter", () => {
    const presenter = new LeaderboardDiscordPresenter({} as never)

    it("shows pending participants", () => {
        const content = presenter.formatMatchContent({
            match: {
                id: 1,
                format: "Bo1",
                winnerUserId: "w1",
                loserUserId: "l1",
                winnerScore: 1,
                loserScore: 0,
                status: MatchStatus.Pending,
            },
            config: { verifyEmoji: "✅" },
            winnerRating: 1000,
            loserRating: 990,
            confirmations: [],
            pendingUsers: ["w1", "l1"],
            rounds: [
                {
                    roundNumber: 1,
                    mapName: "McMinnville OR",
                    winnerUserId: "w1",
                    loserUserId: "l1",
                    playerOneHeroName: "Achilles",
                    playerTwoHeroName: "Alice",
                    firstPlayerUserId: "w1",
                },
            ],
        } as never)

        expect(content).toContain("1:0")
        expect(content).toContain("1. McMinnville OR")
        expect(content).toContain("Achilles vs Alice")
        expect(content).toContain("Первый ход: <@w1>")
        expect(content).toContain("Ожидают подтверждения ✅")
        expect(content).toContain("<@w1>")
        expect(content).toContain("<@l1>")
    })

    it("shows confirmed and pending participants", () => {
        const content = presenter.formatMatchContent({
            match: {
                id: 1,
                format: "Bo3",
                winnerUserId: "w1",
                loserUserId: "l1",
                winnerScore: 2,
                loserScore: 0,
                status: MatchStatus.Pending,
            },
            config: { verifyEmoji: "✅" },
            winnerRating: 1000,
            loserRating: 990,
            confirmations: [{ discordUserId: "w1" }],
            pendingUsers: ["l1"],
            rounds: [],
        } as never)

        expect(content).toContain("Подтвердили ✅: <@w1>")
        expect(content).toContain("Ожидают подтверждения ✅: <@l1>")
    })

    it("shows verified footer", () => {
        const content = presenter.formatMatchContent({
            match: {
                id: 1,
                format: "Bo1",
                winnerUserId: "w1",
                loserUserId: "l1",
                winnerScore: 1,
                loserScore: 0,
                status: MatchStatus.Verified,
            },
            config: { verifyEmoji: "✅" },
            winnerRating: 1001,
            loserRating: 989,
            confirmations: [{ discordUserId: "w1" }, { discordUserId: "l1" }],
            pendingUsers: [],
            rounds: [],
        } as never)

        expect(content).toContain("**Матч верифицирован**")
        expect(content).not.toContain("Ожидают подтверждения")
    })

    it("formats top leaderboard entries", () => {
        const content = presenter.formatTopLeaderboardContent(10, [
            {
                discordUserId: "u1",
                mainRating: 1200,
                totalVerifiedMatches: 15,
                isFrozen: false,
            },
            {
                discordUserId: "u2",
                mainRating: 1100,
                totalVerifiedMatches: 8,
                isFrozen: true,
            },
        ])

        expect(content).toContain("**Топ-10 рейтинга**")
        expect(content).toContain("1. <@u1> — 1200")
        expect(content).toContain("2. <@u2> — 1100")
        expect(content).toContain("❄️")
    })

    it("formats empty top leaderboard", () => {
        const content = presenter.formatTopLeaderboardContent(50, [])

        expect(content).toContain("**Топ-50 рейтинга**")
        expect(content).toContain("Нет игроков")
    })

    it("formats welcome guide", () => {
        const content = presenter.formatWelcomeContent()

        expect(content).toContain("**Настройка (администратор)**")
        expect(content).toContain("/leaderboard-setup-formats")
        expect(content).toContain("/new-rating-match")
        expect(content).toContain("/leaderboard-top")
        expect(content).toContain("/leaderboard-config")
    })

    it("formats guild config", () => {
        const content = presenter.formatGuildConfigContent(
            {
                guildId: "g1",
                favoriteFormats: ["Bo1", "Bo3"],
                verifyEmoji: "✅",
                calibrationRoleId: "role-cal",
                freezeRoleId: null,
                calibrationMatchThreshold: 10,
                inactivityDays: 60,
                initialRating: 1000,
            },
            [
                {
                    id: 1,
                    guildId: "g1",
                    name: "Ангел",
                    minRating: 700,
                    maxRating: 750,
                    roleId: "role-angel",
                },
                {
                    id: 2,
                    guildId: "g1",
                    name: "Гудини",
                    minRating: 1300,
                    maxRating: null,
                    roleId: null,
                },
            ],
        )

        expect(content).toContain("**Настройки рейтинга сервера**")
        expect(content).toContain("Bo1, Bo3")
        expect(content).toContain("<@&role-cal>")
        expect(content).toContain("Заморозка: не задана")
        expect(content).toContain("Ангел (700–750): <@&role-angel>")
        expect(content).toContain("Гудини (1300+): не задана")
    })
})
