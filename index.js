const { DISCORD_TOKEN } = process.env

const { Client, Intents } = require("discord.js")

/* COMMANDS */
const { PingCommand } = require("./commands/ping.command.js")
const { RollChannelCommand } = require("./commands/roll-channel.command.js")
const { RollCommand } = require("./commands/roll.command.js")
const { RollsCommand } = require("./commands/rolls.command.js")

/* HELPERS */
const { processError } = require("./utils.js")
require("./array.limit.js")

const main = async () => {
    const discord = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
        ],
    })

    discord.on("ready", () => {
        console.log(`[Discord] Logged in as ${discord.user.tag}!`)
    })

    discord.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return

        const { commandName } = interaction

        console.log("[Discord][on: Command]", commandName)

        try {
            if (commandName === "ping") {
                return await PingCommand(interaction)
            }

            if (commandName === "roll") {
                return await RollCommand(interaction)
            }

            if (commandName === "rolls") {
                return await RollsCommand(interaction)
            }

            if (commandName === "roll-channel") {
                return await RollChannelCommand(interaction)
            }
        } catch (error) {
            await processError(interaction, error)
        }
    })

    await discord.login(DISCORD_TOKEN)

    // const guild = await discord.guilds.fetch(guildId)
    // const members = await guild.members.fetch()

    // console.log(members.map((m) => m.toJSON()))
}

main()
