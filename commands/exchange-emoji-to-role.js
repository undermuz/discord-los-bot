const { Database } = require("../db/instance.js")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const ExchangeEmojiToRole = async (interaction) => {
    const { channel, guild, options } = interaction

    const role = options.getRole(`role`)
    const emoji = options.getString(`emoji`)
    const messageId = options.getString(`message-id`)
    const removeAllRoles = options.getBoolean(`remove-all-roles`) ?? false

    const messageLink = `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`

    const message = await interaction.channel.messages.fetch(messageId)

    if (!message) {
        await interaction.reply({
            content: `There is no such message ${messageLink}`,
            ephemeral: true,
        })
    }

    const db = Database.getInstance()

    if (!Array.isArray(db.data.emojiToRoles)) db.data.emojiToRoles = []

    db.data.emojiToRoles.push({
        guildId: guild.id,
        role: role.id,
        emoji,
        messageId,
        removeAllRoles,
    })

    await db.write()

    await interaction.reply({
        content: `Everyone who react ${emoji} to message ${messageLink} will receive ${role}`,
        ephemeral: true,
    })

    if (removeAllRoles) {
        await interaction.reply({
            content: `Everyone who remove react ${emoji} from message ${messageLink} will lose all roles`,
            ephemeral: true,
        })
    }
}

module.exports = { ExchangeEmojiToRole }
