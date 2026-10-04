import { Injectable } from "@nestjs/common"
import { isKnownHeroName } from "./heroes.js"
import { isKnownMapName } from "./maps.js"
import {
    formatRequiresHeroes,
    formatTeamSize,
    MatchFormat,
    RegisterMatchRoundDto,
    SeriesLength,
    SeriesResult,
} from "./types.js"

@Injectable()
export class LeaderboardSeriesService {
    parseSeriesSize(seriesLength: SeriesLength): number {
        switch (seriesLength) {
            case SeriesLength.Bo1:
                return 1
            case SeriesLength.Bo2:
                return 2
            case SeriesLength.Bo3:
                return 3
            case SeriesLength.Bo5:
                return 5
        }
    }

    requiredWins(seriesLength: SeriesLength): number {
        switch (seriesLength) {
            case SeriesLength.Bo1:
                return 1
            case SeriesLength.Bo2:
                return 2
            case SeriesLength.Bo3:
                return 2
            case SeriesLength.Bo5:
                return 3
        }
    }

    deriveSeriesResult(
        playerOneUserId: string,
        playerOnePartnerUserId: string | null,
        playerTwoUserId: string,
        playerTwoPartnerUserId: string | null,
        format: MatchFormat,
        seriesLength: SeriesLength,
        rounds: RegisterMatchRoundDto[],
    ): SeriesResult {
        this.validateRounds(
            playerOneUserId,
            playerOnePartnerUserId,
            playerTwoUserId,
            playerTwoPartnerUserId,
            format,
            seriesLength,
            rounds,
        )

        const sideOne = this.sideIds(playerOneUserId, playerOnePartnerUserId)
        let sideOneWins = 0
        let sideTwoWins = 0

        for (const round of rounds) {
            if (sideOne.has(round.winnerUserId)) {
                sideOneWins += 1
            } else {
                sideTwoWins += 1
            }
        }

        if (sideOneWins === sideTwoWins) {
            throw new Error("Series must have a winner")
        }

        const sideOneWon = sideOneWins > sideTwoWins

        return {
            winnerUserId: sideOneWon ? playerOneUserId : playerTwoUserId,
            loserUserId: sideOneWon ? playerTwoUserId : playerOneUserId,
            winnerPartnerUserId: sideOneWon
                ? playerOnePartnerUserId
                : playerTwoPartnerUserId,
            loserPartnerUserId: sideOneWon
                ? playerTwoPartnerUserId
                : playerOnePartnerUserId,
            winnerScore: Math.max(sideOneWins, sideTwoWins),
            loserScore: Math.min(sideOneWins, sideTwoWins),
        }
    }

    validateRounds(
        playerOneUserId: string,
        playerOnePartnerUserId: string | null,
        playerTwoUserId: string,
        playerTwoPartnerUserId: string | null,
        format: MatchFormat,
        seriesLength: SeriesLength,
        rounds: RegisterMatchRoundDto[],
    ): void {
        const participants = [
            playerOneUserId,
            playerOnePartnerUserId,
            playerTwoUserId,
            playerTwoPartnerUserId,
        ].filter((userId): userId is string => Boolean(userId))

        if (new Set(participants).size !== participants.length) {
            throw new Error("Players must be different")
        }

        const teamSize = formatTeamSize(format)

        if (teamSize === 2) {
            if (!playerOnePartnerUserId || !playerTwoPartnerUserId) {
                throw new Error("2x2 requires four players")
            }
        } else if (playerOnePartnerUserId || playerTwoPartnerUserId) {
            throw new Error("This format uses two players")
        }

        const seriesSize = this.parseSeriesSize(seriesLength)
        const winsNeeded = this.requiredWins(seriesLength)
        const sideOne = this.sideIds(playerOneUserId, playerOnePartnerUserId)
        const participantSet = new Set(participants)

        if (rounds.length === 0) {
            throw new Error("At least one round is required")
        }

        if (rounds.length > seriesSize) {
            throw new Error(`Too many rounds for ${seriesLength}`)
        }

        const roundNumbers = new Set<number>()
        let sideOneWins = 0
        let sideTwoWins = 0
        let seriesDecidedAt: number | null = null

        for (const round of rounds) {
            if (roundNumbers.has(round.roundNumber)) {
                throw new Error(`Duplicate round number: ${round.roundNumber}`)
            }

            roundNumbers.add(round.roundNumber)

            if (!participantSet.has(round.winnerUserId)) {
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

            this.validateHeroes(
                format,
                round,
                Boolean(playerOnePartnerUserId),
                Boolean(playerTwoPartnerUserId),
            )

            if (!participantSet.has(round.firstPlayerUserId)) {
                throw new Error(
                    `First player must be one of the players in round ${round.roundNumber}`,
                )
            }

            if (sideOne.has(round.winnerUserId)) {
                sideOneWins += 1
            } else {
                sideTwoWins += 1
            }

            if (sideOneWins > winsNeeded || sideTwoWins > winsNeeded) {
                throw new Error("Invalid round sequence: too many wins")
            }

            if (
                seriesDecidedAt === null &&
                (sideOneWins === winsNeeded || sideTwoWins === winsNeeded)
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

        if (sideOneWins !== winsNeeded && sideTwoWins !== winsNeeded) {
            throw new Error(
                `Series score must reach ${winsNeeded} wins for ${seriesLength}`,
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
        playerOnePartnerUserId: string | null,
        playerTwoUserId: string,
        playerTwoPartnerUserId: string | null,
        rounds: RegisterMatchRoundDto[],
    ): Array<{
        matchId: number
        roundNumber: number
        winnerUserId: string
        loserUserId: string
        mapName: string
        playerOneHeroName: string
        playerTwoHeroName: string
        playerOnePartnerHeroName: string | null
        playerTwoPartnerHeroName: string | null
        firstPlayerUserId: string
    }> {
        const sideOne = this.sideIds(playerOneUserId, playerOnePartnerUserId)

        return rounds.map((round) => ({
            matchId,
            roundNumber: round.roundNumber,
            winnerUserId: round.winnerUserId,
            loserUserId: sideOne.has(round.winnerUserId)
                ? playerTwoUserId
                : playerOneUserId,
            mapName: round.mapName.trim(),
            playerOneHeroName: round.playerOneHeroName.trim(),
            playerTwoHeroName: round.playerTwoHeroName.trim(),
            playerOnePartnerHeroName: this.emptyToNull(
                round.playerOnePartnerHeroName,
            ),
            playerTwoPartnerHeroName: this.emptyToNull(
                round.playerTwoPartnerHeroName,
            ),
            firstPlayerUserId: round.firstPlayerUserId,
        }))
    }

    private sideIds(
        userId: string,
        partnerUserId: string | null,
    ): Set<string> {
        return new Set(
            [userId, partnerUserId].filter((id): id is string => Boolean(id)),
        )
    }

    private emptyToNull(value: string): string | null {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    private validateHeroes(
        format: MatchFormat,
        round: RegisterMatchRoundDto,
        hasPlayerOnePartner: boolean,
        hasPlayerTwoPartner: boolean,
    ): void {
        const heroes = [
            {
                name: round.playerOneHeroName.trim(),
                label: "Player 1",
                required: formatRequiresHeroes(format),
            },
            {
                name: round.playerTwoHeroName.trim(),
                label: "Player 2",
                required: formatRequiresHeroes(format),
            },
            {
                name: round.playerOnePartnerHeroName.trim(),
                label: "Player 1 partner",
                required: formatRequiresHeroes(format) && hasPlayerOnePartner,
            },
            {
                name: round.playerTwoPartnerHeroName.trim(),
                label: "Player 2 partner",
                required: formatRequiresHeroes(format) && hasPlayerTwoPartner,
            },
        ]

        for (const hero of heroes) {
            if (hero.required && !hero.name) {
                throw new Error(
                    `${hero.label} hero is required for round ${round.roundNumber}`,
                )
            }

            if (hero.name && !isKnownHeroName(hero.name)) {
                throw new Error(
                    `Unknown hero for ${hero.label} in round ${round.roundNumber}`,
                )
            }
        }
    }
}
