import { readFileSync } from "node:fs"
import { join } from "node:path"

const HERO_AUTOCOMPLETE_LIMIT = 25

let cachedHeroNames: string[] | null = null

function loadHeroNames(): string[] {
    if (cachedHeroNames) {
        return cachedHeroNames
    }

    const heroesPath = join(process.cwd(), "data", "heroes.json")
    const raw = JSON.parse(readFileSync(heroesPath, "utf8")) as {
        heroes: { name: string }[]
    }

    cachedHeroNames = raw.heroes
        .map((hero) => hero.name)
        .sort((left, right) => left.localeCompare(right))

    return cachedHeroNames
}

export function getHeroAutocompleteChoices(
    query: string,
    limit = HERO_AUTOCOMPLETE_LIMIT,
): { name: string; value: string }[] {
    const normalizedQuery = query.trim().toLowerCase()

    return loadHeroNames()
        .filter((name) =>
            normalizedQuery.length === 0
                ? true
                : name.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, limit)
        .map((name) => ({ name, value: name }))
}

export function isKnownHeroName(name: string): boolean {
    const normalizedName = name.trim().toLowerCase()

    return loadHeroNames().some(
        (heroName) => heroName.toLowerCase() === normalizedName,
    )
}
