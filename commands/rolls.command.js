const { BaseUserRolls } = require("./base-user-rolls")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const RollsCommand = async (interaction) => {
    const users = []

    for (let i = 1; i <= 25; i++) {
        const user = interaction.options.getUser(`member_${i}`)

        if (user) {
            users.push(user)
        }
    }

    if (users.length < 2) {
        await interaction.reply(`Ошибка: Минимум игроков 2`)

        return
    }

    await BaseUserRolls(interaction, users)
}

module.exports = { RollsCommand }
