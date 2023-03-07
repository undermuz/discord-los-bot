/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const PingCommand = async (interaction) => {
    await interaction.reply("Pong!")
}

module.exports = { PingCommand }
