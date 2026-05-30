import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomIntFromInterval } from "../../common/utils/random.util.js"
import {
    RollOutcome,
    RollParticipant,
    RollReactionAsset,
    RollResult,
} from "./rolling.types.js"

@Injectable()
export class RollingService {
    constructor(private readonly configService: ConfigService) {}

    async rollParticipants(
        participants: RollParticipant[],
        cap = 100,
    ): Promise<RollResult[]> {
        const results: RollResult[] = []

        for (const participant of participants) {
            const value = await randomIntFromInterval(0, cap)
            results.push({ participant, value })
        }

        return results
    }

    resolveOutcome(results: RollResult[]): RollOutcome {
        let maxScore = Math.max(...results.map((result) => result.value))
        let minScore = Math.min(...results.map((result) => result.value))

        if (minScore === maxScore) {
            minScore = -1
        }

        if (maxScore === 0) {
            maxScore = -1
        }

        const sortedResults = [...results].sort((a, b) => a.value - b.value)
        const winners = sortedResults.filter(
            (result) => result.value === maxScore,
        )
        const losers = sortedResults.filter(
            (result) => result.value === minScore,
        )

        return {
            results: sortedResults,
            winners,
            losers,
            minScore,
            maxScore,
        }
    }

    async pickSpecialFlag(username: string): Promise<string | null> {
        const specialUsernames =
            this.configService.get<string[]>("app.specialUsernames") ?? []
        const specialFlags =
            this.configService.get<string[]>("app.specialFlags") ?? []

        if (!specialUsernames.length || !specialFlags.length) {
            return null
        }

        const matches = specialUsernames.some((name) =>
            username.toLowerCase().includes(name.toLowerCase()),
        )

        if (!matches) {
            return null
        }

        const index = await randomIntFromInterval(0, specialFlags.length - 1)
        return specialFlags[index] ?? null
    }

    getReactionAsset(value: number): RollReactionAsset | null {
        if (value === 0) {
            return {
                value,
                url: "https://memepedia.ru/wp-content/uploads/2017/04/%D0%B5%D0%B1%D0%B0%D1%82%D1%8C-%D1%82%D1%8B-%D0%BB%D0%BE%D1%85-%D0%BE%D1%80%D0%B8%D0%B3%D0%B8%D0%BD%D0%B0%D0%BB.jpg",
            }
        }

        if (value === 99) {
            return {
                value,
                url: "http://risovach.ru/upload/2013/02/mem/so-close_12108107_orig_.jpeg",
            }
        }

        if (value === 100) {
            return {
                value,
                url: "https://i.ndtvimg.com/i/2015-04/successkid_650x400_51429162983.jpg",
            }
        }

        return null
    }
}
