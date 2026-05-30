// Remember to set type: module in package.json or use .mjs extension
const { join, dirname } = require("node:path")

class DatabaseClass {
    constructor() {
        this.file = join(process.cwd(), "db.json")
        this._instance = null
    }

    async initialize() {
        const { Low } = await import("lowdb")
        const { JSONFile } = await import("lowdb/node")

        const adapter = new JSONFile(this.file)
        const defaultData = { emojiToRoles: [] }

        this._instance = new Low(adapter, defaultData)

        console.log("[Discord][Database] Database initializing", this.file)

        await this._instance.read()

        console.log("[Discord][Database] Database initialized")
    }

    getInstance() {
        return this._instance
    }
}

const Database = new DatabaseClass()

module.exports = { Database }
