import { registerAs } from "@nestjs/config"

export default registerAs("app", () => ({
    discordToken: process.env.DISCORD_TOKEN ?? "",
    discordAppId: process.env.DISCORD_APP_ID ?? "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    dbPath: process.env.DB_PATH ?? "./data/bot.sqlite",
    specialUsernames:
        process.env.SPECIAL_USERNAMES?.split(",").filter(Boolean) ?? [],
    specialFlags: process.env.SPECIAL_FLAGS?.split(",").filter(Boolean) ?? [],
}))
