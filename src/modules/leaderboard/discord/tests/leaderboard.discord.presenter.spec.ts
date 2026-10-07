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
        expect(content).toContain("McMinnville OR")
        expect(content).toContain("Achilles vs Alice")
        expect(content).toContain("Первый ход: <@w1>")
        expect(content).toContain("Ожидают подтверждения:")
        expect(content).toContain("<@w1>")
        expect(content).toContain("<@l1>")
    })

    it("omits heroes when the format has none", () => {
        const content = presenter.formatMatchContent({
            match: {
                id: 1,
                format: "LosEnduranceAutumn2026",
                seriesLength: "Bo1",
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
                    playerOneHeroName: "",
                    playerTwoHeroName: "",
                    firstPlayerUserId: "l1",
                },
            ],
        } as never)

        expect(content).toContain("LosEnduranceAutumn2026")
        expect(content).toContain("Первый ход: <@l1>")
        expect(content).not.toContain("Герои:")
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
        expect(content).toContain("Ожидают подтверждения: <@l1>")
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

    it("shows cancelled footer", () => {
        const content = presenter.formatMatchContent({
            match: {
                id: 1,
                format: "1x1",
                seriesLength: "Bo1",
                winnerUserId: "w1",
                loserUserId: "l1",
                winnerScore: 1,
                loserScore: 0,
                status: MatchStatus.Cancelled,
                cancelledByUserId: "admin-1",
            },
            config: { verifyEmoji: "✅", rejectEmoji: "❌" },
            winnerRating: 1000,
            loserRating: 990,
            confirmations: [],
            pendingUsers: ["w1", "l1"],
            rounds: [],
        } as never)

        expect(content).toContain("**Матч отменён** (<@admin-1>)")
        expect(content).not.toContain("Ожидают подтверждения")
        expect(content).not.toContain("**Матч верифицирован**")
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
        expect(content).not.toContain("/new-2x2")
        expect(content).toContain("/um-1x1-bo1")
        expect(content).toContain("/um-1x1-bo5")
        expect(content).toContain("round_N_first")
        expect(content).toContain("first_moves")
        expect(content).not.toContain("p1_first_rounds")
        expect(content).toContain("/um-2x2")
        expect(content).toContain("/um-1x1")
        expect(content).toContain("/leaderboard-top")
        expect(content).toContain("/leaderboard-matches")
        expect(content).toContain("/leaderboard-adjust-rating")
        expect(content).toContain("/leaderboard-config")
        expect(content).toContain("**4**")
        expect(content).toContain("**90**")
    })

    it("formats guild config", () => {
        const content = presenter.formatGuildConfigContent(
            {
                guildId: "g1",
                favoriteFormats: ["1x1", "2x2"],
                verifyEmoji: "✅",
                rejectEmoji: "❌",
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
        expect(content).toContain("1x1, 2x2")
        expect(content).toContain("**Эмодзи отмены:** ❌")
        expect(content).toContain("<@&role-cal>")
        expect(content).toContain("Заморозка: не задана")
        expect(content).toContain("Ангел (700–749): <@&role-angel>")
        expect(content).toContain("Гудини (1300+): не задана")
    })

    it("formats recent matches with player and start date", () => {
        const content = presenter
            .formatRecentMatchBlocks(
                [
                    {
                        match: {
                            id: 4,
                            format: "1x1",
                            seriesLength: "Bo1",
                            winnerUserId: "w1",
                            loserUserId: "l1",
                            winnerPartnerUserId: null,
                            loserPartnerUserId: null,
                            winnerScore: 1,
                            loserScore: 0,
                            status: MatchStatus.Verified,
                            createdAt: new Date(2026, 1, 3, 15, 4),
                            cancelledByUserId: null,
                        },
                        rounds: [
                            {
                                roundNumber: 1,
                                mapName: "McMinnville OR",
                                winnerUserId: "w1",
                                playerOneHeroName: "Achilles",
                                playerTwoHeroName: "Alice",
                                playerOnePartnerHeroName: null,
                                playerTwoPartnerHeroName: null,
                                firstPlayerUserId: "l1",
                            },
                        ],
                    },
                ] as never,
                {
                    discordUserId: "w1",
                    from: new Date(2026, 0, 1),
                },
            )
            .join("\n\n")

        expect(content).toContain("**Последние матчи**")
        expect(content).toContain("Игрок: <@w1>")
        expect(content).toContain("С: 01.01.2026")
        expect(content).toContain(
            "**#4** 1x1 Bo1 1:0 — верифицирован — 03.02.2026 15:04",
        )
        expect(content).toContain("McMinnville OR")
        expect(content).toContain("Achilles vs Alice")
        expect(content).toContain("Первый ход: <@l1>")
    })

    it("formats an empty recent match list", () => {
        const content = presenter.formatRecentMatchBlocks([], {}).join("\n")

        expect(content).toContain("**Последние матчи**")
        expect(content).toContain("Нет матчей.")
    })
})
