const { Database } = require("../db/instance.js")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const CancelExchangeEmojiToRole = async (interaction) => {
    const messageId = interaction.options.getString(`message-id`)

    const { channel, guild } = interaction

    // const message = await interaction.channel.messages.fetch(messageId)

    const messageLink = `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`

    const db = Database.getInstance()

    if (!db) {
        await interaction.reply({
            content: `There is no database`,
            ephemeral: true,
        })

        return
    }

    if (!Array.isArray(db.data.emojiToRoles)) db.data.emojiToRoles = []

    const item = db.data.emojiToRoles.find(
        (item) => item.messageId === messageId
    )

    if (!item) {
        await interaction.reply({
            content: `There is no exchange for message ${messageLink}`,
            ephemeral: true,
        })

        return
    }

    db.data.emojiToRoles = db.data.emojiToRoles.filter(
        (item) => item.messageId !== messageId
    )

    await db.write()

    await interaction.reply({
        content: `Exchange effect for message ${messageLink} has canceled`,
        ephemeral: true,
    })
}

module.exports = { CancelExchangeEmojiToRole }
