const { BaseUserRolls } = require("./base-user-rolls")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const RollChannelCommand = async (interaction) => {
    const users = []
    const exUsers = []

    const channel = interaction.options.getChannel("roll_channel", true)

    if (channel.type !== "GUILD_VOICE") {
        await interaction.reply(`Ошибка: Канал должен быть голосовым`)

        return
    }

    for (let i = 1; i <= 25; i++) {
        const user = interaction.options.getUser(`exclude_member_${i}`)

        if (user) {
            exUsers.push(user)
        }
    }

    const members = channel.members

    members.forEach((member) => {
        if (exUsers.find((u) => u.id === member.user.id)) {
            return
        }

        users.push(member.user)
    })

    if (users.length < 2) {
        await interaction.reply(`Ошибка: Минимум игроков 2`)

        return
    }

    if (users.length > 25) {
        await interaction.reply(`Ошибка: Максимум игроков 25`)

        return
    }

    await BaseUserRolls(interaction, users)
}

module.exports = { RollChannelCommand }
