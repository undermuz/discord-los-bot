export const RATING_DECIMALS = 2
const RATING_SCALE = 10 ** RATING_DECIMALS

export function roundRating(value: number): number {
    return Math.round(value * RATING_SCALE) / RATING_SCALE
}

export function formatRating(value: number): string {
    return roundRating(value).toFixed(RATING_DECIMALS)
}
