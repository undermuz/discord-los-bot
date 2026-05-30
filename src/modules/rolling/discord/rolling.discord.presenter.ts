import { Injectable, Logger } from "@nestjs/common"
import { ChatInputCommandInteraction, User } from "discord.js"
import { formatRussianList } from "../../../common/utils/list-format.util.js"
import { RollingService } from "../rolling.service.js"
import { RollingStatisticsService } from "../rolling-statistics.service.js"
import { RollOutcome, RollParticipant, RollResult } from "../rolling.types.js"

@Injectable()
export class RollingDiscordPresenter {
    private readonly logger = new Logger(RollingDiscordPresenter.name)

    constructor(
        private readonly rollingService: RollingService,
        private readonly statisticsService: RollingStatisticsService,
    ) {}

    async renderMultiUserRoll(
        interaction: ChatInputCommandInteraction,
        users: User[],
    ): Promise<void> {
        const participants = users.map((user) => this.toParticipant(user))
        const rawResults =
            await this.rollingService.rollParticipants(participants)
        const outcome = this.rollingService.resolveOutcome(rawResults)
        const texts: string[] = []

        const echo = (...lines: string[]) => {
            texts.push(...lines)
        }

        echo("🎲🎲🎲")
        echo(
            `Бросают ${formatRussianList(
                users.map((user) => user.toString()),
                users.length - 1,
            )} и ${users[users.length - 1]?.toString() ?? ""}\n`,
        )

        await interaction.reply(texts.join("\n"))

        for (const result of rawResults) {
            echo(this.formatRevealLine(result))
            await interaction.editReply(texts.join("\n"))
        }

        texts.splice(texts.length - rawResults.length, rawResults.length)

        for (const user of users) {
            const isLoser = outcome.losers.some(
                (result) => result.participant.id === user.id,
            )
            const isWinner = outcome.winners.some(
                (result) => result.participant.id === user.id,
            )

            if (!isLoser) {
                this.statisticsService.dropFromLosers(
                    interaction.channelId,
                    user.id,
                )
            }

            if (!isWinner) {
                this.statisticsService.dropFromWinners(
                    interaction.channelId,
                    user.id,
                )
            }
        }

        for (const result of outcome.results) {
            echo(
                await this.formatResultLine(
                    interaction.channelId,
                    result,
                    outcome,
                ),
            )
        }

        await interaction.editReply(texts.join("\n"))

        if (outcome.losers.length === 0) {
            echo("❓❓❓ Никто не проиграл ❓❓❓")
        }

        if (outcome.winners.length === 0) {
            echo("❓❓❓ Никто не выиграл ❓❓❓")
        }

        this.logger.log(
            `[Rolls][Statistics: ${interaction.channelId}] ${JSON.stringify(
                this.statisticsService.getStatistics(interaction.channelId),
            )}`,
        )

        await interaction.editReply(texts.join("\n"))

        for (const result of outcome.results) {
            const asset = this.rollingService.getReactionAsset(result.value)

            if (!asset) {
                continue
            }

            await interaction.followUp({
                content: `${result.participant.displayName}`,
                files: [asset.url],
            })
        }
    }

    private toParticipant(user: User): RollParticipant {
        return {
            id: user.id,
            displayName: user.toString(),
            username: user.username,
        }
    }

    private formatRevealLine(result: RollResult): string {
        return `***\`${this.padRollValue(result.value)}\`*** ----------------- ${result.participant.displayName}`
    }

    private async formatResultLine(
        channelId: string,
        result: RollResult,
        outcome: RollOutcome,
    ): Promise<string> {
        const isLoser = result.value === outcome.minScore
        const isWinner = result.value === outcome.maxScore && !isLoser

        let statusFlag = "----"
        let statusText = ""

        if (isLoser) {
            statusFlag = " ❌"
            const looseCount = this.statisticsService.processLoser(
                channelId,
                result.participant.id,
            )
            const postfix = this.statisticsService.getPostfixText(
                looseCount,
                true,
            )
            if (postfix) {
                statusText = ` - ${postfix}`
            }
        } else if (isWinner) {
            statusFlag = " ✅"
            const winCount = this.statisticsService.processWinner(
                channelId,
                result.participant.id,
            )
            const postfix = this.statisticsService.getPostfixText(
                winCount,
                false,
            )
            if (postfix) {
                statusText = ` - ${postfix}`
            }
        }

        if (result.participant.username) {
            const specialFlag = await this.rollingService.pickSpecialFlag(
                result.participant.username,
            )

            if (specialFlag) {
                statusFlag = specialFlag
            }
        }

        return `***\`${this.padRollValue(result.value)}\`*** -------------${statusFlag} ${result.participant.displayName}${statusText}`
    }

    private padRollValue(value: number): string {
        const raw = `${value}`
        if (raw.length === 1) {
            return ` ${raw}`
        }

        return raw
    }
}
