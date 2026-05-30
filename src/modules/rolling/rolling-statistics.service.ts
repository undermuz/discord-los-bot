import { Injectable } from "@nestjs/common"

@Injectable()
export class RollingStatisticsService {
    private readonly winners = new Map<string, Map<string, number>>()
    private readonly losers = new Map<string, Map<string, number>>()

    processLoser(channelId: string, userId: string): number {
        const channelStats = this.getChannelLosers(channelId)

        if (channelStats.has(userId)) {
            const next = (channelStats.get(userId) ?? 0) + 1
            channelStats.set(userId, next)
            return next
        }

        channelStats.set(userId, 0)
        return 0
    }

    processWinner(channelId: string, userId: string): number {
        const channelStats = this.getChannelWinners(channelId)

        if (channelStats.has(userId)) {
            const next = (channelStats.get(userId) ?? 0) + 1
            channelStats.set(userId, next)
            return next
        }

        channelStats.set(userId, 0)
        return 0
    }

    dropFromLosers(channelId: string, userId: string): void {
        this.getChannelLosers(channelId).delete(userId)
    }

    dropFromWinners(channelId: string, userId: string): void {
        this.getChannelWinners(channelId).delete(userId)
    }

    getStatistics(channelId: string): {
        winners: Record<string, number | undefined>
        losers: Record<string, number | undefined>
    } {
        return {
            winners: Object.fromEntries(this.getChannelWinners(channelId)),
            losers: Object.fromEntries(this.getChannelLosers(channelId)),
        }
    }

    getPostfixText(count: number, isLoose = true): string {
        const emoji = isLoose ? ["😡", "🤬", "🧨"] : ["👍", "😎", "💪"]

        if (count === 0) {
            return ""
        }

        if (count <= 5) {
            const emojiIndex = count - 3
            return (
                this.repeatString(count, "❗") +
                (emojiIndex >= 0 ? ` ${emoji[emojiIndex]}` : "")
            )
        }

        if (count === 6) {
            return ` Это баг? x${count}`
        }

        if (count === 7) {
            return ` Зачем? x${count}`
        }

        if (count === 8) {
            return ` Олег? x${count}`
        }

        if (count === 9) {
            return ` Просто не играй x${count}`
        }

        if (count >= 10) {
            return ` x${count} - Нужно ли мне предусматривать вариант под такой результат? Есть ли в этом смысл? Кто нибудь вообще когда либо увидит это сообщение?`
        }

        return " ОПЯТЬ"
    }

    private getChannelWinners(channelId: string): Map<string, number> {
        if (!this.winners.has(channelId)) {
            this.winners.set(channelId, new Map())
        }

        return this.winners.get(channelId)!
    }

    private getChannelLosers(channelId: string): Map<string, number> {
        if (!this.losers.has(channelId)) {
            this.losers.set(channelId, new Map())
        }

        return this.losers.get(channelId)!
    }

    private repeatString(count: number, value: string): string {
        return value.repeat(count)
    }
}
