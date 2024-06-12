const { Database } = require("../db/instance.js")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const ExchangeEmojiToRole = async (interaction) => {
    const role = interaction.options.getRole(`role`)
    const emoji = interaction.options.getString(`emoji`)
    const messageId = interaction.options.getString(`message-id`)
    const removeAllRoles =
        interaction.options.getString(`remove-all-roles`) ?? false

    const message = await interaction.channel.messages.fetch(messageId)

    const db = Database.getInstance()

    if (!Array.isArray(db.data.emojiToRoles)) db.data.emojiToRoles = []

    db.data.emojiToRoles.push({
        guildId: interaction.guild.id,
        role: role.id,
        emoji,
        messageId,
        removeAllRoles,
    })

    await db.write()

    await interaction.reply({
        content: `Everyone who react ${emoji} to message ${message} will receive ${role}`,
        ephemeral: true,
    })
}

module.exports = { ExchangeEmojiToRole }
