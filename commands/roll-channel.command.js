const { rollUsers } = require("../utils")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const RollChannelCommand = async (interaction) => {
    const users = []
    const exusers = []

    const channel = interaction.options.getChannel("roll_channel", true)

    if (channel.type !== "GUILD_VOICE") {
        await interaction.reply(`Ошибка: Канал должен быть голосовым`)

        return
    }

    for (let i = 1; i <= 25; i++) {
        const user = interaction.options.getUser(`exclude_member_${i}`)

        if (user) {
            exusers.push(user)
        }
    }

    const members = channel.members

    console.log(channel)
    console.log(members)

    members.forEach((member) => {
        if (exusers.find((u) => u.id === member.user.id)) {
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

    const results = await rollUsers(users)

    const maxScore = Math.max(...results.map((r) => r.value))
    const minScore = Math.min(...results.map((r) => r.value))

    const texts = []

    texts.push(
        `Бросают ${users.limit(users.length - 1).join(", ")} и ${
            users[users.length - 1]
        }\n`
    )

    await interaction.reply(texts.join("\n"))

    for (let res of results) {
        texts.push(`${res.user} выбрасывает ${res.value}`)

        await interaction.editReply(texts.join("\n"))
    }

    texts.push("")

    const winners = results.filter((r) => r.value === maxScore)
    const losers = results.filter((r) => r.value === minScore)

    console.log("maxScore", maxScore)
    console.log("minScore", minScore)
    console.log("winners", winners)
    console.log("losers", losers)

    if (losers.length > 0) {
        if (losers.length === 1) {
            const loser = losers[0]

            texts.push(`Выбросил наименьший результат: ${loser.user} 🤣`)
        } else {
            texts.push(
                `Выбросили наименьший результат: ${losers
                    .limit(losers.length - 1)
                    .map((r) => r.user)
                    .join(", ")} и ${losers[losers.length - 1].user} 🤣🤣🤣`
            )
        }
    }

    if (winners.length > 0) {
        if (winners.length === 1) {
            const winner = winners[0]

            texts.push(`Выбросил наибольший результат: ${winner.user} 🎉`)
        } else {
            texts.push(
                `Выбросили наибольший результат:${winners
                    .limit(winners.length - 1)
                    .map((r) => r.user)
                    .join(", ")} и ${winners[winners.length - 1].user} 🎉🎉🎉`
            )
        }
    }

    await interaction.editReply(texts.join("\n"))

    for (let res of results) {
        if (res.value === 0) {
            await interaction.followUp(
                `${res.user}\nhttps://memepedia.ru/wp-content/uploads/2017/04/%D0%B5%D0%B1%D0%B0%D1%82%D1%8C-%D1%82%D1%8B-%D0%BB%D0%BE%D1%85-%D0%BE%D1%80%D0%B8%D0%B3%D0%B8%D0%BD%D0%B0%D0%BB.jpg`
            )
        } else if (res.value === 99) {
            await interaction.followUp(
                `${res.user}\nhttp://risovach.ru/upload/2013/02/mem/so-close_12108107_orig_.jpeg`
            )
        } else if (res.value === 100) {
            await interaction.followUp(
                `${res.user}\nhttps://i.ndtvimg.com/i/2015-04/successkid_650x400_51429162983.jpg`
            )
        }
    }

    return
}

module.exports = { RollChannelCommand }
