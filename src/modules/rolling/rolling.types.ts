export interface RollParticipant {
    id: string
    displayName: string
    username?: string
}

export interface RollResult {
    participant: RollParticipant
    value: number
}

export interface RollOutcome {
    results: RollResult[]
    winners: RollResult[]
    losers: RollResult[]
    minScore: number
    maxScore: number
}

export interface RollReactionAsset {
    value: number
    url: string
}
