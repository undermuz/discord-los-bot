import { Injectable } from "@nestjs/common"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const AUTOCOMPLETE_LIMIT = 25
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type CatalogEntry = {
    name: string
}

type NameCache = {
    names: readonly string[]
    lookup: ReadonlySet<string>
    expiresAt: number
}

@Injectable()
export class LeaderboardCatalogService {
    private mapsCache: NameCache | null = null
    private heroesCache: NameCache | null = null

    getMapAutocompleteChoices(
        query: string,
        limit = AUTOCOMPLETE_LIMIT,
    ): { name: string; value: string }[] {
        return this.toAutocompleteChoices(this.getMaps().names, query, limit)
    }

    getHeroAutocompleteChoices(
        query: string,
        limit = AUTOCOMPLETE_LIMIT,
    ): { name: string; value: string }[] {
        return this.toAutocompleteChoices(this.getHeroes().names, query, limit)
    }

    isKnownMapName(name: string): boolean {
        return this.getMaps().lookup.has(name.trim().toLowerCase())
    }

    isKnownHeroName(name: string): boolean {
        return this.getHeroes().lookup.has(name.trim().toLowerCase())
    }

    resetCache(): void {
        const loadedAt = Date.now()
        const maps = this.readNames("maps.json", "maps")
        const heroes = this.readNames("heroes.json", "heroes")

        this.mapsCache = this.toNameCache(maps, loadedAt)
        this.heroesCache = this.toNameCache(heroes, loadedAt)
    }

    private getMaps(): NameCache {
        if (this.isFresh(this.mapsCache)) {
            return this.mapsCache
        }

        this.mapsCache = this.toNameCache(
            this.readNames("maps.json", "maps"),
            Date.now(),
        )

        return this.mapsCache
    }

    private getHeroes(): NameCache {
        if (this.isFresh(this.heroesCache)) {
            return this.heroesCache
        }

        this.heroesCache = this.toNameCache(
            this.readNames("heroes.json", "heroes"),
            Date.now(),
        )

        return this.heroesCache
    }

    private isFresh(cache: NameCache | null): cache is NameCache {
        return cache !== null && cache.expiresAt > Date.now()
    }

    private readNames(
        fileName: string,
        collectionKey: "maps" | "heroes",
    ): string[] {
        const filePath = join(process.cwd(), "data", fileName)
        const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<
            string,
            CatalogEntry[]
        >
        const entries = raw[collectionKey] ?? []

        return entries
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right))
    }

    private toNameCache(names: string[], loadedAt: number): NameCache {
        return {
            names,
            lookup: new Set(names.map((name) => name.toLowerCase())),
            expiresAt: loadedAt + CACHE_TTL_MS,
        }
    }

    private toAutocompleteChoices(
        names: readonly string[],
        query: string,
        limit: number,
    ): { name: string; value: string }[] {
        const normalizedQuery = query.trim().toLowerCase()

        return names
            .filter((name) =>
                normalizedQuery.length === 0
                    ? true
                    : name.toLowerCase().includes(normalizedQuery),
            )
            .slice(0, limit)
            .map((name) => ({ name, value: name }))
    }
}
