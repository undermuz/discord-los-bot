const Database = require("better-sqlite3")
const db = new Database("data/bot.sqlite", { readonly: true })
const tables = db
    .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('migrations', 'rating_tier_roles')",
    )
    .all()
console.log("tables", tables)
try {
    console.log("migrations", db.prepare("SELECT * FROM migrations").all())
} catch (error) {
    console.log("migrations error", error.message)
}
try {
    console.log(
        "tiers",
        db
            .prepare(
                "SELECT name, minRating, maxRating FROM rating_tier_roles ORDER BY minRating",
            )
            .all(),
    )
} catch (error) {
    console.log("tiers error", error.message)
}
