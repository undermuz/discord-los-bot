export function formatRussianList(items: string[], limit?: number): string {
    const slice = limit !== undefined ? items.slice(0, limit) : items

    if (slice.length === 0) {
        return ""
    }

    if (slice.length === 1) {
        return slice[0]
    }

    return `${slice.slice(0, -1).join(", ")} и ${slice[slice.length - 1]}`
}
