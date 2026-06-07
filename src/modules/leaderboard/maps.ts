import { readFileSync } from "node:fs"
import { join } from "node:path"

const MAP_AUTOCOMPLETE_LIMIT = 25

let cachedMapNames: string[] | null = null

function loadMapNames(): string[] {
    if (cachedMapNames) {
        return cachedMapNames
    }

    const mapsPath = join(process.cwd(), "data", "maps.json")
    const raw = JSON.parse(readFileSync(mapsPath, "utf8")) as {
        maps: { name: string }[]
    }

    cachedMapNames = raw.maps
        .map((map) => map.name)
        .sort((left, right) => left.localeCompare(right))

    return cachedMapNames
}

export function getMapAutocompleteChoices(
    query: string,
    limit = MAP_AUTOCOMPLETE_LIMIT,
): { name: string; value: string }[] {
    const normalizedQuery = query.trim().toLowerCase()

    return loadMapNames()
        .filter((name) =>
            normalizedQuery.length === 0
                ? true
                : name.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, limit)
        .map((name) => ({ name, value: name }))
}

export function isKnownMapName(name: string): boolean {
    const normalizedName = name.trim().toLowerCase()

    return loadMapNames().some(
        (mapName) => mapName.toLowerCase() === normalizedName,
    )
}
