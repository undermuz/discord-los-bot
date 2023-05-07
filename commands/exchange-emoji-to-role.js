const { Database } = require("../db/instance.js")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const ExchangeEmojiToRole = async (interaction) => {
    const role = interaction.options.getRole(`role`)
    const emoji = interaction.options.getString(`emoji`)
    const messageId = interaction.options.getString(`message-id`)

    const db = Database.getInstance()

    if (!Array.isArray(db.data.emojiToRoles)) db.data.emojiToRoles = []

    db.data.emojiToRoles.push({
        role: role.id,
        emoji,
        messageId,
    })

    await db.write()

    await interaction.reply(
        `Everyone who react ${emoji} to message <@${messageId}> will receive @${role.name}`
    )
}

module.exports = { ExchangeEmojiToRole }
