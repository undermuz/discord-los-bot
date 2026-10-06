import { Injectable, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import {
    MatchConfirmation,
    RatingMatch,
    RatingMatchRound,
} from "../../database/entities/rating-match.entity.js"
import {
    PlayerRating,
    PlayerState,
} from "../../database/entities/player-rating.entity.js"
import { LeaderboardAggregateService } from "./aggregate.service.js"
import { LeaderboardConfigService } from "./config.service.js"
import {
    computeK1,
    computeK2,
    LeaderboardRatingService,
} from "./rating.service.js"
import { roundRating } from "./rating.util.js"
import { LeaderboardRoleService } from "./role.service.js"
import { LeaderboardSeriesService } from "./series.service.js"
import {
    isFormatSeriesAllowed,
    LeaderboardTopEntry,
    MatchFormat,
    MatchStatus,
    PlayerLeaderboardSummary,
    PlayerRoleState,
    RegisterMatchDto,
    RoleSyncPlan,
    SeriesLength,
    MATCH_FORMATS,
} from "./types.js"

@Injectable()
export class LeaderboardService {
    private readonly logger = new Logger(LeaderboardService.name)

    constructor(
        @InjectRepository(RatingMatch)
        private readonly matchRepository: Repository<RatingMatch>,
        @InjectRepository(MatchConfirmation)
        private readonly confirmationRepository: Repository<MatchConfirmation>,
        @InjectRepository(RatingMatchRound)
        private readonly roundRepository: Repository<RatingMatchRound>,
        @InjectRepository(PlayerRating)
        private readonly playerRatingRepository: Repository<PlayerRating>,
        @InjectRepository(PlayerState)
        private readonly playerStateRepository: Repository<PlayerState>,
        private readonly configService: LeaderboardConfigService,
        private readonly ratingService: LeaderboardRatingService,
        private readonly aggregateService: LeaderboardAggregateService,
        private readonly roleService: LeaderboardRoleService,
        private readonly seriesService: LeaderboardSeriesService,
    ) {}

    async registerMatch(dto: RegisterMatchDto): Promise<RatingMatch> {
        await this.configService.requireGuildConfig(dto.guildId)

        if (!isFormatSeriesAllowed(dto.format, dto.seriesLength)) {
            throw new Error(
                `Series ${dto.seriesLength} is not available for ${dto.format}`,
            )
        }

        const seriesResult = this.seriesService.deriveSeriesResult(
            dto.playerOneUserId,
            dto.playerOnePartnerUserId,
            dto.playerTwoUserId,
            dto.playerTwoPartnerUserId,
            dto.format,
            dto.seriesLength,
            dto.rounds,
        )

        return this.matchRepository.manager.transaction(async (manager) => {
            const match = await manager.save(
                manager.create(RatingMatch, {
                    guildId: dto.guildId,
                    channelId: dto.channelId,
                    format: dto.format,
                    seriesLength: dto.seriesLength,
                    registeredByUserId: dto.registeredByUserId,
                    winnerUserId: seriesResult.winnerUserId,
                    loserUserId: seriesResult.loserUserId,
                    winnerPartnerUserId: seriesResult.winnerPartnerUserId,
                    loserPartnerUserId: seriesResult.loserPartnerUserId,
                    winnerScore: seriesResult.winnerScore,
                    loserScore: seriesResult.loserScore,
                    status: MatchStatus.Pending,
                }),
            )

            const roundEntities = this.seriesService
                .toRoundEntities(
                    match.id,
                    dto.playerOneUserId,
                    dto.playerOnePartnerUserId,
                    dto.playerTwoUserId,
                    dto.playerTwoPartnerUserId,
                    dto.rounds,
                )
                .map((round) => manager.create(RatingMatchRound, round))

            await manager.save(roundEntities)

            for (const userId of this.getRequiredParticipants(match)) {
                if (userId === dto.registeredByUserId) {
                    await manager.save(
                        manager.create(MatchConfirmation, {
                            matchId: match.id,
                            discordUserId: userId,
                            autoConfirmed: true,
                        }),
                    )
                }
            }

            return match
        })
    }

    async attachMessageId(matchId: number, messageId: string): Promise<void> {
        await this.matchRepository.update(matchId, { messageId })
    }

    async findMatchByMessage(
        guildId: string,
        messageId: string,
    ): Promise<RatingMatch | null> {
        return this.matchRepository.findOne({
            where: { guildId, messageId, status: MatchStatus.Pending },
        })
    }

    async confirmMatch(
        guildId: string,
        messageId: string,
        discordUserId: string,
    ): Promise<RatingMatch | null> {
        const match = await this.findMatchByMessage(guildId, messageId)

        if (!match) {
            return null
        }

        if (!this.getRequiredParticipants(match).includes(discordUserId)) {
            return null
        }

        const existing = await this.confirmationRepository.findOne({
            where: { matchId: match.id, discordUserId },
        })

        if (!existing) {
            await this.confirmationRepository.save(
                this.confirmationRepository.create({
                    matchId: match.id,
                    discordUserId,
                    autoConfirmed: false,
                }),
            )
        }

        const isComplete = await this.isMatchFullyConfirmed(match)

        if (!isComplete) {
            return match
        }

        return this.finalizeMatch(match.id)
    }

    async finalizeMatch(matchId: number): Promise<RatingMatch> {
        const match = await this.matchRepository.findOne({
            where: { id: matchId },
        })

        if (!match || match.status !== MatchStatus.Pending) {
            throw new Error("Match is not pending")
        }

        const config = await this.configService.requireGuildConfig(
            match.guildId,
        )

        const winnerIds = this.sideUserIds(
            match.winnerUserId,
            match.winnerPartnerUserId,
        )
        const loserIds = this.sideUserIds(
            match.loserUserId,
            match.loserPartnerUserId,
        )
        const winnerRatings = await Promise.all(
            winnerIds.map((userId) =>
                this.getOrCreatePlayerRating(
                    match.guildId,
                    userId,
                    match.format,
                    config.initialRating,
                ),
            ),
        )
        const loserRatings = await Promise.all(
            loserIds.map((userId) =>
                this.getOrCreatePlayerRating(
                    match.guildId,
                    userId,
                    match.format,
                    config.initialRating,
                ),
            ),
        )
        const seriesScore = {
            winnerScore: match.winnerScore,
            loserScore: match.loserScore,
        }
        const winnerAverage = this.averageRating(
            winnerRatings.map((rating) => rating.rating),
        )
        const loserAverage = this.averageRating(
            loserRatings.map((rating) => rating.rating),
        )

        if (winnerRatings.length === 1 && loserRatings.length === 1) {
            const winnerRating = winnerRatings[0]
            const loserRating = loserRatings[0]
            const winnerWinStreak = await this.getConsecutiveWins(
                match.guildId,
                winnerRating.discordUserId,
                match.format,
            )
            const delta = this.ratingService.applyResult(
                match.seriesLength,
                winnerRating.rating,
                loserRating.rating,
                seriesScore,
                {
                    winner: {
                        k1: computeK1(winnerWinStreak),
                        k2: computeK2(
                            winnerRating.verifiedMatchCount <
                                config.calibrationMatchThreshold,
                            winnerRating.calibrationCompleted,
                        ),
                    },
                    loser: {
                        k1: 1,
                        k2: computeK2(
                            loserRating.verifiedMatchCount <
                                config.calibrationMatchThreshold,
                            loserRating.calibrationCompleted,
                        ),
                    },
                },
            )

            winnerRating.rating = this.ratingService.applyDelta(
                winnerRating.rating,
                delta.winnerDelta,
            )
            loserRating.rating = this.ratingService.applyDelta(
                loserRating.rating,
                delta.loserDelta,
            )
        } else {
            const base = this.ratingService.applyResult(
                match.seriesLength,
                winnerAverage,
                loserAverage,
                seriesScore,
                {
                    winner: { k1: 1, k2: 1 },
                    loser: { k1: 1, k2: 1 },
                },
            )

            for (const playerRating of winnerRatings) {
                const streak = await this.getConsecutiveWins(
                    match.guildId,
                    playerRating.discordUserId,
                    match.format,
                )
                const k1 =
                    match.seriesLength === SeriesLength.Bo5
                        ? 1
                        : computeK1(streak)
                const k2 =
                    match.seriesLength === SeriesLength.Bo5
                        ? 1
                        : computeK2(
                              playerRating.verifiedMatchCount <
                                  config.calibrationMatchThreshold,
                              playerRating.calibrationCompleted,
                          )

                playerRating.rating = this.ratingService.applyDelta(
                    playerRating.rating,
                    roundRating(base.winnerDelta * k1 * k2),
                )
            }

            for (const playerRating of loserRatings) {
                const k2 =
                    match.seriesLength === SeriesLength.Bo5
                        ? 1
                        : computeK2(
                              playerRating.verifiedMatchCount <
                                  config.calibrationMatchThreshold,
                              playerRating.calibrationCompleted,
                          )

                playerRating.rating = this.ratingService.applyDelta(
                    playerRating.rating,
                    roundRating(base.loserDelta * k2),
                )
            }
        }

        const now = new Date()
        const updatedRatings = [...winnerRatings, ...loserRatings]

        for (const playerRating of updatedRatings) {
            playerRating.verifiedMatchCount += 1
            playerRating.lastPlayedAt = now
            this.markCalibrationCompletedIfNeeded(
                playerRating,
                config.calibrationMatchThreshold,
            )
        }

        await this.playerRatingRepository.save(updatedRatings)

        for (const userId of this.getRequiredParticipants(match)) {
            await this.unfreezePlayer(match.guildId, userId)
        }

        match.status = MatchStatus.Verified
        match.verifiedAt = now

        return this.matchRepository.save(match)
    }

    async getPlayerRoleState(
        guildId: string,
        discordUserId: string,
    ): Promise<PlayerRoleState> {
        const config = await this.configService.requireGuildConfig(guildId)
        const playerState = await this.getOrCreatePlayerState(
            guildId,
            discordUserId,
        )

        return {
            isFrozen: playerState.isFrozen,
            totalVerifiedMatches:
                await this.aggregateService.getTotalVerifiedMatches(
                    guildId,
                    discordUserId,
                ),
            mainRating: await this.aggregateService.getMainRating(
                guildId,
                discordUserId,
                config,
            ),
        }
    }

    async buildRoleSyncPlan(
        guildId: string,
        discordUserId: string,
        currentRoleIds: string[],
    ): Promise<RoleSyncPlan> {
        const config = await this.configService.requireGuildConfig(guildId)
        const tiers = await this.configService.getTiers(guildId)
        const state = await this.getPlayerRoleState(guildId, discordUserId)

        return this.roleService.buildRoleSyncPlan(
            config,
            tiers,
            state,
            currentRoleIds,
        )
    }

    async getMatchDisplayData(matchId: number) {
        const match = await this.matchRepository.findOne({
            where: { id: matchId },
        })

        if (!match) {
            throw new Error("Match not found")
        }

        const config = await this.configService.requireGuildConfig(
            match.guildId,
        )
        const confirmations = await this.confirmationRepository.find({
            where: { matchId: match.id },
        })
        const rounds = await this.roundRepository.find({
            where: { matchId: match.id },
            order: { roundNumber: "ASC" },
        })

        const winnerRating = this.averageRating(
            await Promise.all(
                this.sideUserIds(
                    match.winnerUserId,
                    match.winnerPartnerUserId,
                ).map((userId) =>
                    this.aggregateService.getFormatRating(
                        match.guildId,
                        userId,
                        match.format,
                        config.initialRating,
                    ),
                ),
            ),
        )
        const loserRating = this.averageRating(
            await Promise.all(
                this.sideUserIds(
                    match.loserUserId,
                    match.loserPartnerUserId,
                ).map((userId) =>
                    this.aggregateService.getFormatRating(
                        match.guildId,
                        userId,
                        match.format,
                        config.initialRating,
                    ),
                ),
            ),
        )

        const pendingUsers = this.getRequiredParticipants(match).filter(
            (userId) =>
                !confirmations.some(
                    (confirmation) => confirmation.discordUserId === userId,
                ),
        )

        return {
            match,
            config,
            winnerRating,
            loserRating,
            confirmations,
            pendingUsers,
            rounds,
        }
    }

    async freezeInactivePlayer(
        guildId: string,
        discordUserId: string,
    ): Promise<void> {
        const state = await this.getOrCreatePlayerState(guildId, discordUserId)
        state.isFrozen = true
        await this.playerStateRepository.save(state)

        const ratings = await this.playerRatingRepository.find({
            where: { guildId, discordUserId },
        })

        for (const rating of ratings) {
            rating.verifiedMatchCount = 0
        }

        if (ratings.length > 0) {
            await this.playerRatingRepository.save(ratings)
        }
    }

    async resetPlayerRating(
        guildId: string,
        discordUserId: string,
        rating?: number,
    ): Promise<number> {
        const config = await this.configService.requireGuildConfig(guildId)
        const targetRating = roundRating(rating ?? config.initialRating)
        const ratings = await Promise.all(
            MATCH_FORMATS.map((format) =>
                this.getOrCreatePlayerRating(
                    guildId,
                    discordUserId,
                    format,
                    config.initialRating,
                ),
            ),
        )

        for (const playerRating of ratings) {
            playerRating.rating = targetRating
        }

        await this.playerRatingRepository.save(ratings)

        return this.aggregateService.getMainRating(
            guildId,
            discordUserId,
            config,
        )
    }

    async resetPlayerStats(
        guildId: string,
        discordUserId: string,
        resetCalibrationCompleted = false,
    ): Promise<void> {
        const config = await this.configService.requireGuildConfig(guildId)
        const ratings = await Promise.all(
            MATCH_FORMATS.map((format) =>
                this.getOrCreatePlayerRating(
                    guildId,
                    discordUserId,
                    format,
                    config.initialRating,
                ),
            ),
        )

        for (const playerRating of ratings) {
            playerRating.verifiedMatchCount = 0
            playerRating.lastPlayedAt = null

            if (resetCalibrationCompleted) {
                playerRating.calibrationCompleted = false
            }
        }

        await this.playerRatingRepository.save(ratings)

        const state = await this.getOrCreatePlayerState(guildId, discordUserId)

        if (state.isFrozen) {
            state.isFrozen = false
            await this.playerStateRepository.save(state)
        }
    }

    getRequiredParticipants(match: RatingMatch): string[] {
        return [
            ...this.sideUserIds(match.winnerUserId, match.winnerPartnerUserId),
            ...this.sideUserIds(match.loserUserId, match.loserPartnerUserId),
        ]
    }

    async getPlayerLeaderboardSummary(
        guildId: string,
        discordUserId: string,
    ): Promise<PlayerLeaderboardSummary> {
        const config = await this.configService.requireGuildConfig(guildId)
        const state = await this.getPlayerRoleState(guildId, discordUserId)
        const formatRatings = await Promise.all(
            MATCH_FORMATS.map(async (format) => {
                const playerRating = await this.playerRatingRepository.findOne({
                    where: { guildId, discordUserId, format },
                })
                const verifiedMatchCount = playerRating?.verifiedMatchCount ?? 0
                const consecutiveWins = await this.getConsecutiveWins(
                    guildId,
                    discordUserId,
                    format,
                )

                return {
                    format,
                    rating: await this.aggregateService.getFormatRating(
                        guildId,
                        discordUserId,
                        format,
                        config.initialRating,
                    ),
                    k1: computeK1(consecutiveWins),
                    k2: computeK2(
                        verifiedMatchCount < config.calibrationMatchThreshold,
                        playerRating?.calibrationCompleted ?? false,
                    ),
                }
            }),
        )

        return { state, formatRatings }
    }

    async getTopPlayers(
        guildId: string,
        size: number,
    ): Promise<LeaderboardTopEntry[]> {
        const config = await this.configService.requireGuildConfig(guildId)
        const ratings = await this.playerRatingRepository.find({
            where: { guildId },
        })

        const ratingsByUser = new Map<string, PlayerRating[]>()

        for (const rating of ratings) {
            const userRatings = ratingsByUser.get(rating.discordUserId) ?? []
            userRatings.push(rating)
            ratingsByUser.set(rating.discordUserId, userRatings)
        }

        const entries: LeaderboardTopEntry[] = []

        for (const [discordUserId, userRatings] of ratingsByUser) {
            const totalVerifiedMatches = userRatings.reduce(
                (total, rating) => total + rating.verifiedMatchCount,
                0,
            )

            if (totalVerifiedMatches === 0) {
                continue
            }

            const state = await this.getOrCreatePlayerState(
                guildId,
                discordUserId,
            )
            const mainRating = await this.aggregateService.getMainRating(
                guildId,
                discordUserId,
                config,
            )

            entries.push({
                discordUserId,
                mainRating,
                totalVerifiedMatches,
                isFrozen: state.isFrozen,
            })
        }

        return entries
            .sort(
                (left, right) =>
                    right.mainRating - left.mainRating ||
                    right.totalVerifiedMatches - left.totalVerifiedMatches,
            )
            .slice(0, size)
    }

    private async isMatchFullyConfirmed(match: RatingMatch): Promise<boolean> {
        const confirmations = await this.confirmationRepository.find({
            where: { matchId: match.id },
        })
        const confirmedIds = new Set(
            confirmations.map((confirmation) => confirmation.discordUserId),
        )

        return this.getRequiredParticipants(match).every((userId) =>
            confirmedIds.has(userId),
        )
    }

    private async getOrCreatePlayerRating(
        guildId: string,
        discordUserId: string,
        format: MatchFormat,
        initialRating: number,
    ): Promise<PlayerRating> {
        const existing = await this.playerRatingRepository.findOne({
            where: { guildId, discordUserId, format },
        })

        if (existing) {
            return existing
        }

        return this.createPlayerRating(
            guildId,
            discordUserId,
            format,
            initialRating,
        )
    }

    private createPlayerRating(
        guildId: string,
        discordUserId: string,
        format: MatchFormat,
        initialRating: number,
    ): Promise<PlayerRating> {
        return this.playerRatingRepository.save(
            this.playerRatingRepository.create({
                guildId,
                discordUserId,
                format,
                rating: roundRating(initialRating),
            }),
        )
    }

    private markCalibrationCompletedIfNeeded(
        playerRating: PlayerRating,
        calibrationMatchThreshold: number,
    ): void {
        if (playerRating.verifiedMatchCount >= calibrationMatchThreshold) {
            playerRating.calibrationCompleted = true
        }
    }

    private async getConsecutiveWins(
        guildId: string,
        discordUserId: string,
        format: MatchFormat,
    ): Promise<number> {
        const matches = await this.matchRepository.find({
            where: {
                guildId,
                format,
                status: MatchStatus.Verified,
            },
            order: { verifiedAt: "DESC" },
        })

        let streak = 0

        for (const verifiedMatch of matches) {
            const winners = this.sideUserIds(
                verifiedMatch.winnerUserId,
                verifiedMatch.winnerPartnerUserId,
            )
            const losers = this.sideUserIds(
                verifiedMatch.loserUserId,
                verifiedMatch.loserPartnerUserId,
            )

            if (winners.includes(discordUserId)) {
                streak += 1
                continue
            }

            if (!losers.includes(discordUserId)) {
                continue
            }

            break
        }

        return streak
    }

    private async getOrCreatePlayerState(
        guildId: string,
        discordUserId: string,
    ): Promise<PlayerState> {
        let state = await this.playerStateRepository.findOne({
            where: { guildId, discordUserId },
        })

        if (!state) {
            state = await this.playerStateRepository.save(
                this.playerStateRepository.create({
                    guildId,
                    discordUserId,
                    isFrozen: false,
                }),
            )
        }

        return state
    }

    private sideUserIds(
        userId: string,
        partnerUserId: string | null,
    ): string[] {
        return [userId, partnerUserId].filter((id): id is string => Boolean(id))
    }

    private averageRating(ratings: number[]): number {
        if (ratings.length === 0) {
            return 0
        }

        return roundRating(
            ratings.reduce((total, rating) => total + rating, 0) /
                ratings.length,
        )
    }

    private async unfreezePlayer(
        guildId: string,
        discordUserId: string,
    ): Promise<void> {
        const state = await this.getOrCreatePlayerState(guildId, discordUserId)

        if (!state.isFrozen) {
            return
        }

        state.isFrozen = false
        await this.playerStateRepository.save(state)
    }
}
