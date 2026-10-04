import { Injectable } from "@nestjs/common"
import { Message, PartialMessage } from "discord.js"
import { LeaderboardGuildConfig } from "../../../database/entities/leaderboard-guild-config.entity.js"
import { RatingTierRole } from "../../../database/entities/rating-tier-role.entity.js"
import { formatRating } from "../rating.util.js"
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

        const participantIds = [
            match.winnerUserId,
            match.winnerPartnerUserId,
            match.loserUserId,
            match.loserPartnerUserId,
        ].filter((userId): userId is string => Boolean(userId))
        const confirmedUsers = participantIds.filter(
            (userId) => !pendingUsers.includes(userId),
        )

        const lines = [
            `**Новый рейтинговый матч (${match.format} ${match.seriesLength}) — ${match.winnerScore}:${match.loserScore}**`,
            `${this.formatSide(match.winnerUserId, match.winnerPartnerUserId)} vs ${this.formatSide(match.loserUserId, match.loserPartnerUserId)}`,
            `Рейтинг: ${formatRating(winnerRating)} / ${formatRating(loserRating)}`,
            "",
        ]

        for (const round of rounds) {
            const sideOneHeroes = this.formatHeroes(
                round.playerOneHeroName,
                round.playerOnePartnerHeroName,
            )
            const sideTwoHeroes = this.formatHeroes(
                round.playerTwoHeroName,
                round.playerTwoPartnerHeroName,
            )
            const hasHeroes = sideOneHeroes.length > 0 || sideTwoHeroes.length > 0
            const details = hasHeroes
                ? `   Герои: ${sideOneHeroes} vs ${sideTwoHeroes} | Первый ход: <@${round.firstPlayerUserId}>`
                : `   Первый ход: <@${round.firstPlayerUserId}>`

            lines.push(
                `${round.roundNumber}. ${round.mapName} — <@${round.winnerUserId}>`,
                details,
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

    private formatSide(userId: string, partnerUserId: string | null): string {
        return partnerUserId
            ? `<@${userId}> <@${partnerUserId}>`
            : `<@${userId}>`
    }

    private formatHeroes(
        heroName: string | null,
        partnerHeroName: string | null,
    ): string {
        return [heroName, partnerHeroName]
            .map((name) => name?.trim() ?? "")
            .filter((name) => name.length > 0)
            .join(", ")
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

            return `${index + 1}. <@${entry.discordUserId}> — ${formatRating(entry.mainRating)} (${entry.totalVerifiedMatches} матч.)${frozenSuffix}`
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
                    : `${tier.minRating}–${tier.maxRating - 1}`

            return `• ${tier.name} (${range}): ${formatRole(tier.roleId)}`
        })

        return [
            "**Настройки рейтинга сервера**",
            "",
            `**Избранные форматы:** ${config.favoriteFormats.join(", ") || "не заданы"}`,
            `**Эмодзи верификации:** ${config.verifyEmoji}`,
            `**Стартовый рейтинг:** ${formatRating(config.initialRating)}`,
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
            "2. `/leaderboard-setup-formats` - выберите форматы для расчёта основного рейтинга.",
            "3. `/leaderboard-setup-special-roles` - задайте роли для **Калибровка** и **Заморозка**.",
            "4. `/leaderboard-setup-roles` - привяжите Discord-роли к тирам. Команду нужно выполнить для каждого тира.",
            "",
            "**Для участников**",
            "",
            "• `/new-rating-match` — матч 1x1 или LosEnduranceAutumn2026: `player_1`, `player_2`, `format`, `series` (Bo1, Bo2, Bo3, Bo5). Для каждого раунда — `map_N`, `round_N_winner`, `p1_hero_N`, `p2_hero_N`. Герои не нужны для LosEnduranceAutumn2026. Кто ходил первым: `p1_first_rounds` (например `1,3`). Итог и счёт выводятся автоматически. Оба игрока подтверждают реакцией ✅.",
            "• `/new-2x2` — матч 2x2: четыре игрока и `series` (Bo1, Bo2, Bo3). Для каждого раунда — карта, победитель и герой каждого игрока. Подтверждают все четверо.",
            "• `/um-1x1` — короткий Bo1 для LosEnduranceAutumn2026: `p1`, `p2`, `winner`, `map`. Имена героев не нужны. Первым ходит `p2`.",
            "• `/leaderboard [player]` - посмотреть рейтинг себя или другого игрока.",
            "• `/leaderboard-top [size]` - топ игроков (10, 50 или 100) по основному рейтингу.",
            "• `/leaderboard-config` - текущие настройки рейтинга сервера.",
            "",
            "**Правила**",
            "",
            "• Стартовый рейтинг - **1000** по каждому формату.",
            "• Основной рейтинг - среднее по избранным форматам сервера.",
            "• Меньше **4** верифицированных матчей - роль калибровки.",
            "• **90** дней без игры в избранных форматах - заморозка и повторная калибровка (рейтинг сохраняется).",
        ].join("\n")
    }
}
