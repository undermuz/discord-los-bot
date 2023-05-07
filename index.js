const { DISCORD_TOKEN } = process.env

const { Client, Intents } = require("discord.js")

/* COMMANDS */
const { PingCommand } = require("./commands/ping.command.js")
const { RollChannelCommand } = require("./commands/roll-channel.command.js")
const { RollCommand } = require("./commands/roll.command.js")
const { RollsCommand } = require("./commands/rolls.command.js")

/* HELPERS */
const { processError } = require("./utils.js")
const { ExchangeEmojiToRole } = require("./commands/exchange-emoji-to-role.js")
const { Database } = require("./db/instance.js")
require("./array.limit.js")

const main = async () => {
    const discord = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        ],
        partials: ["MESSAGE", "CHANNEL", "REACTION"],
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

            if (commandName === "exchange-emoji-to-role") {
                return await ExchangeEmojiToRole(interaction)
            }
        } catch (error) {
            await processError(interaction, error)
        }
    })

    discord.on("messageReactionRemove", async (reaction, user) => {
        console.log(`[Discord][Event: messageReactionRemove]`)
        // When a reaction is received, check if the structure is partial
        if (reaction.partial) {
            // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
            try {
                await reaction.fetch()
            } catch (error) {
                console.error(
                    "Something went wrong when fetching the message:",
                    error
                )
                // Return as `reaction.message.author` may be undefined/null
                return
            }
        }

        // Now the message has been cached and is fully available
        console.log(
            `${reaction.message.author}'s message "${reaction.message.content}" gained a reaction ${reaction.emoji.name}!`
        )
        // The reaction is now also fully available and the properties will be reflected accurately:
        console.log(
            `${reaction.count} user(s) have given the same reaction to this message!`
        )

        const emojiToRole = Database.getInstance().data.emojiToRoles.find(
            (item) => item.messageId === reaction.message.id
        )

        if (emojiToRole && emojiToRole.emoji === reaction.emoji.name) {
            const member = await reaction.message.guild?.members.fetch(user)

            if (member) {
                const hasRole = member.roles.cache.has(emojiToRole.role)

                if (hasRole) {
                    member.roles.remove(emojiToRole.role)
                } else {
                    console.log(`Member has not role`)
                }
            } else {
                console.log(`Member not found`)
            }
        }
    })

    discord.on("messageReactionAdd", async (reaction, user) => {
        console.log(`[Discord][Event: messageReactionAdd]`)
        // When a reaction is received, check if the structure is partial
        if (reaction.partial) {
            // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
            try {
                await reaction.fetch()
            } catch (error) {
                console.error(
                    "Something went wrong when fetching the message:",
                    error
                )
                // Return as `reaction.message.author` may be undefined/null
                return
            }
        }

        // Now the message has been cached and is fully available
        console.log(
            `${reaction.message.author}'s message "${reaction.message.content}" gained a reaction ${reaction.emoji.name}!`
        )
        // The reaction is now also fully available and the properties will be reflected accurately:
        console.log(
            `${reaction.count} user(s) have given the same reaction to this message!`
        )

        const emojiToRole = Database.getInstance().data.emojiToRoles.find(
            (item) => item.messageId === reaction.message.id
        )

        if (emojiToRole && emojiToRole.emoji === reaction.emoji.name) {
            const member = await reaction.message.guild?.members.fetch(user)

            if (member) {
                const hasRole = member.roles.cache.has(emojiToRole.role)

                if (!hasRole) {
                    member.roles.add(emojiToRole.role)
                    console.log(`[Discord] Role added to user`)
                } else {
                    console.log(`Member already has role`)
                }
            } else {
                console.log(`Member not found`)
            }
        }
    })

    await Database.initialize()

    await discord.login(DISCORD_TOKEN)

    // const guild = await discord.guilds.fetch(guildId)
    // const members = await guild.members.fetch()

    // console.log(members.map((m) => m.toJSON()))
}

main()
