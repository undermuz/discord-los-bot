import { Injectable } from "@nestjs/common"
import { MatchFormat, SeriesScore } from "./types.js"

export interface RatingDelta {
    winnerDelta: number
    loserDelta: number
}

export interface RatingStrategy {
    apply(
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
    ): RatingDelta
}

class StubRatingStrategy implements RatingStrategy {
    apply(): RatingDelta {
        return { winnerDelta: 1, loserDelta: -1 }
    }
}

@Injectable()
export class LeaderboardRatingService {
    private readonly strategies: Record<MatchFormat, RatingStrategy> = {
        [MatchFormat.Bo1]: new StubRatingStrategy(),
        [MatchFormat.Bo2]: new StubRatingStrategy(),
        [MatchFormat.Bo3]: new StubRatingStrategy(),
        [MatchFormat.Bo5]: new StubRatingStrategy(),
    }

    applyResult(
        format: MatchFormat,
        winnerRating: number,
        loserRating: number,
        seriesScore: SeriesScore,
    ): RatingDelta {
        return this.strategies[format].apply(
            winnerRating,
            loserRating,
            seriesScore,
        )
    }

    applyDelta(rating: number, delta: number): number {
        return rating + delta
    }
}
