import { Injectable } from "@nestjs/common"
import { Message, PartialMessage } from "discord.js"
import { LeaderboardGuildConfig } from "../../../database/entities/leaderboard-guild-config.entity.js"
import { RatingTierRole } from "../../../database/entities/rating-tier-role.entity.js"
import { LeaderboardService } from "../leaderboard.service.js"
import { MatchStatus } from "../types.js"
import type { LeaderboardTopEntry } from "../types.js"

export type MatchDisplayData = Awaited<
    ReturnType<LeaderboardService["getMatchDisplayData"]>
>

@Injectable()
export class LeaderboardDiscordPresenter {
    constructor(private readonly leaderboardService: LeaderboardService) {}

    async buildMatchMessageContent(matchId: number): Promise<string> {
        const display =
            await this.leaderboardService.getMatchDisplayData(matchId)

        return this.formatMatchContent(display)
    }

    formatMatchContent(display: MatchDisplayData): string {
        const {
            match,
            config,
            winnerRating,
            loserRating,
            pendingUsers,
            rounds,
        } = display

        const participantIds = [match.winnerUserId, match.loserUserId]
        const confirmedUsers = participantIds.filter(
            (userId) => !pendingUsers.includes(userId),
        )

        const lines = [
            `**Новый рейтинговый матч (${match.format}) — ${match.winnerScore}:${match.loserScore}**`,
            `<@${match.winnerUserId}> vs <@${match.loserUserId}>`,
            `Рейтинг: ${winnerRating} / ${loserRating}`,
            "",
        ]

        for (const round of rounds) {
            lines.push(
                `${round.roundNumber}. ${round.mapName} — <@${round.winnerUserId}>`,
                `   Герои: ${round.playerOneHeroName} vs ${round.playerTwoHeroName} | Первый ход: <@${round.firstPlayerUserId}>`,
            )
        }

        if (rounds.length > 0) {
            lines.push("")
        }

        if (match.status === MatchStatus.Verified) {
            lines.push("**Матч верифицирован**")
            return lines.join("\n")
        }

        if (confirmedUsers.length > 0) {
            const confirmedMentions = confirmedUsers
                .map((userId) => `<@${userId}>`)
                .join(", ")
            lines.push(
                `Подтвердили ${config.verifyEmoji}: ${confirmedMentions}`,
            )
        }

        if (pendingUsers.length > 0) {
            const pendingMentions = pendingUsers
                .map((userId) => `<@${userId}>`)
                .join(", ")
            lines.push(
                `Ожидают подтверждения ${config.verifyEmoji}: ${pendingMentions}`,
            )
        } else if (confirmedUsers.length === participantIds.length) {
            lines.push("Все участники подтверждены.")
        }

        return lines.join("\n")
    }

    async refreshMatchMessage(
        message: Message | PartialMessage,
        matchId: number,
    ): Promise<void> {
        const fetched = message.partial ? await message.fetch() : message

        if (!fetched.editable) {
            return
        }

        const content = await this.buildMatchMessageContent(matchId)
        await fetched.edit(content)
    }

    formatTopLeaderboardContent(
        size: number,
        entries: LeaderboardTopEntry[],
    ): string {
        if (entries.length === 0) {
            return `**Топ-${size} рейтинга**\nНет игроков с верифицированными матчами.`
        }

        const lines = entries.map((entry, index) => {
            const frozenSuffix = entry.isFrozen ? " ❄️" : ""

            return `${index + 1}. <@${entry.discordUserId}> — ${entry.mainRating} (${entry.totalVerifiedMatches} матч.)${frozenSuffix}`
        })

        return [`**Топ-${size} рейтинга**`, "", ...lines].join("\n")
    }

    formatGuildConfigContent(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
    ): string {
        const formatRole = (roleId: string | null): string =>
            roleId ? `<@&${roleId}>` : "не задана"

        const tierLines = tiers.map((tier) => {
            const range =
                tier.maxRating === null
                    ? `${tier.minRating}+`
                    : `${tier.minRating}–${tier.maxRating}`

            return `• ${tier.name} (${range}): ${formatRole(tier.roleId)}`
        })

        return [
            "**Настройки рейтинга сервера**",
            "",
            `**Избранные форматы:** ${config.favoriteFormats.join(", ") || "не заданы"}`,
            `**Эмодзи верификации:** ${config.verifyEmoji}`,
            `**Стартовый рейтинг:** ${config.initialRating}`,
            `**Порог калибровки:** ${config.calibrationMatchThreshold} матч.`,
            `**Неактивность:** ${config.inactivityDays} дн.`,
            "",
            "**Специальные роли**",
            `• Калибровка: ${formatRole(config.calibrationRoleId)}`,
            `• Заморозка: ${formatRole(config.freezeRoleId)}`,
            "",
            "**Тиры**",
            ...tierLines,
        ].join("\n")
    }

    formatWelcomeContent(): string {
        return [
            "**Рейтинговый бот — руководство**",
            "",
            "**Настройка (администратор)**",
            "",
            "1. В настройках сервера поднимите роль бота **выше** рейтинговых ролей",
            "2. `/leaderboard-setup-formats` - выберите форматы (Bo1, Bo2, Bo3, Bo5) для расчёта основного рейтинга.",
            "3. `/leaderboard-setup-special-roles` - задайте роли для **Калибровка** и **Заморозка**.",
            "4. `/leaderboard-setup-roles` - привяжите Discord-роли к тирам (Ангел … Гудини). Команду нужно выполнить для каждого тира.",
            "",
            "**Для участников**",
            "",
            "• `/new-rating-match` — зарегистрировать серию: `player_1`, `player_2`, формат, для каждого раунда — `map_N`, `round_N_winner`, `p1_hero_N`, `p2_hero_N`. Кто ходил первым: `p1_first_rounds` (например `1,3` — раунды, где первым ходил player_1). Итог и счёт выводятся автоматически. Оба игрока подтверждают реакцией ✅.",
            "• `/leaderboard [player]` - посмотреть рейтинг себя или другого игрока.",
            "• `/leaderboard-top [size]` - топ игроков (10, 50 или 100) по основному рейтингу.",
            "• `/leaderboard-config` - текущие настройки рейтинга сервера.",
            "",
            "**Правила**",
            "",
            "• Стартовый рейтинг - **1000** по каждому формату.",
            "• Основной рейтинг - среднее по избранным форматам сервера.",
            "• Меньше **10** верифицированных матчей - роль калибровки.",
            "• **60** дней без игры в избранных форматах - заморозка и сброс к 1000.",
        ].join("\n")
    }
}
