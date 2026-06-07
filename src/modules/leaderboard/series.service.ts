import { Injectable } from "@nestjs/common"
import { isKnownHeroName } from "./heroes.js"
import { isKnownMapName } from "./maps.js"
import { MatchFormat, RegisterMatchRoundDto, SeriesResult } from "./types.js"

@Injectable()
export class LeaderboardSeriesService {
    parseFormatSize(format: MatchFormat): number {
        switch (format) {
            case MatchFormat.Bo1:
                return 1
            case MatchFormat.Bo2:
                return 2
            case MatchFormat.Bo3:
                return 3
            case MatchFormat.Bo5:
                return 5
        }
    }

    requiredWins(formatSize: number): number {
        return Math.ceil(formatSize / 2)
    }

    deriveSeriesResult(
        playerOneUserId: string,
        playerTwoUserId: string,
        format: MatchFormat,
        rounds: RegisterMatchRoundDto[],
    ): SeriesResult {
        this.validateRounds(playerOneUserId, playerTwoUserId, format, rounds)

        const winsByPlayer = new Map<string, number>([
            [playerOneUserId, 0],
            [playerTwoUserId, 0],
        ])

        for (const round of rounds) {
            winsByPlayer.set(
                round.winnerUserId,
                (winsByPlayer.get(round.winnerUserId) ?? 0) + 1,
            )
        }

        const playerOneWins = winsByPlayer.get(playerOneUserId) ?? 0
        const playerTwoWins = winsByPlayer.get(playerTwoUserId) ?? 0

        if (playerOneWins === playerTwoWins) {
            throw new Error("Series must have a winner")
        }

        const winnerUserId =
            playerOneWins > playerTwoWins ? playerOneUserId : playerTwoUserId
        const loserUserId =
            winnerUserId === playerOneUserId ? playerTwoUserId : playerOneUserId
        const winnerScore = Math.max(playerOneWins, playerTwoWins)
        const loserScore = Math.min(playerOneWins, playerTwoWins)

        return {
            winnerUserId,
            loserUserId,
            winnerScore,
            loserScore,
        }
    }

    validateRounds(
        playerOneUserId: string,
        playerTwoUserId: string,
        format: MatchFormat,
        rounds: RegisterMatchRoundDto[],
    ): void {
        if (playerOneUserId === playerTwoUserId) {
            throw new Error("Players must be different")
        }

        const formatSize = this.parseFormatSize(format)
        const winsNeeded = this.requiredWins(formatSize)
        const participants = new Set([playerOneUserId, playerTwoUserId])

        if (rounds.length === 0) {
            throw new Error("At least one round is required")
        }

        if (rounds.length > formatSize) {
            throw new Error(`Too many rounds for ${format}`)
        }

        const roundNumbers = new Set<number>()
        let playerOneWins = 0
        let playerTwoWins = 0
        let seriesDecidedAt: number | null = null

        for (const round of rounds) {
            if (roundNumbers.has(round.roundNumber)) {
                throw new Error(`Duplicate round number: ${round.roundNumber}`)
            }

            roundNumbers.add(round.roundNumber)

            if (!participants.has(round.winnerUserId)) {
                throw new Error("Round winner must be one of the players")
            }

            if (!round.mapName.trim()) {
                throw new Error(
                    `Map name is required for round ${round.roundNumber}`,
                )
            }

            if (!isKnownMapName(round.mapName)) {
                throw new Error(`Unknown map for round ${round.roundNumber}`)
            }

            if (!round.playerOneHeroName.trim()) {
                throw new Error(
                    `Player 1 hero is required for round ${round.roundNumber}`,
                )
            }

            if (!round.playerTwoHeroName.trim()) {
                throw new Error(
                    `Player 2 hero is required for round ${round.roundNumber}`,
                )
            }

            if (!isKnownHeroName(round.playerOneHeroName)) {
                throw new Error(
                    `Unknown hero for player 1 in round ${round.roundNumber}`,
                )
            }

            if (!isKnownHeroName(round.playerTwoHeroName)) {
                throw new Error(
                    `Unknown hero for player 2 in round ${round.roundNumber}`,
                )
            }

            if (!participants.has(round.firstPlayerUserId)) {
                throw new Error(
                    `First player must be one of the players in round ${round.roundNumber}`,
                )
            }

            if (round.winnerUserId === playerOneUserId) {
                playerOneWins += 1
            } else {
                playerTwoWins += 1
            }

            if (playerOneWins > winsNeeded || playerTwoWins > winsNeeded) {
                throw new Error("Invalid round sequence: too many wins")
            }

            if (
                seriesDecidedAt === null &&
                (playerOneWins === winsNeeded || playerTwoWins === winsNeeded)
            ) {
                seriesDecidedAt = round.roundNumber
            }

            if (
                seriesDecidedAt !== null &&
                round.roundNumber > seriesDecidedAt
            ) {
                throw new Error("Extra rounds after series was decided")
            }
        }

        if (playerOneWins !== winsNeeded && playerTwoWins !== winsNeeded) {
            throw new Error(
                `Series score must reach ${winsNeeded} wins for ${format}`,
            )
        }

        for (let roundNumber = 1; roundNumber <= rounds.length; roundNumber++) {
            if (!roundNumbers.has(roundNumber)) {
                throw new Error("Round numbers must be sequential from 1")
            }
        }
    }

    toRoundEntities(
        matchId: number,
        playerOneUserId: string,
        playerTwoUserId: string,
        rounds: RegisterMatchRoundDto[],
    ): Array<{
        matchId: number
        roundNumber: number
        winnerUserId: string
        loserUserId: string
        mapName: string
        playerOneHeroName: string
        playerTwoHeroName: string
        firstPlayerUserId: string
    }> {
        return rounds.map((round) => ({
            matchId,
            roundNumber: round.roundNumber,
            winnerUserId: round.winnerUserId,
            loserUserId:
                round.winnerUserId === playerOneUserId
                    ? playerTwoUserId
                    : playerOneUserId,
            mapName: round.mapName.trim(),
            playerOneHeroName: round.playerOneHeroName.trim(),
            playerTwoHeroName: round.playerTwoHeroName.trim(),
            firstPlayerUserId: round.firstPlayerUserId,
        }))
    }
}
