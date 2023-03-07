const { rollUsers } = require("../utils")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User[]} users
 */
const BaseUserRolls = async (interaction, users) => {
    const results = await rollUsers(users)

    let maxScore = Math.max(...results.map((r) => r.value))
    let minScore = Math.min(...results.map((r) => r.value))

    if (minScore === maxScore) {
        minScore = -1
    }

    if (maxScore === 0) {
        maxScore = -1
    }

    const texts = []

    const echo = (...args) => texts.push(...args)

    echo("🎲🎲🎲")

    echo(
        `Бросают ${users.limit(users.length - 1).join(", ")} и ${
            users[users.length - 1]
        }\n`
    )

    await interaction.reply(texts.join("\n"))

    for (let res of results) {
        echo(`***${res.value}*** выбрасывает ${res.user}`)

        await interaction.editReply(texts.join("\n"))
    }

    echo("")

    const winners = results.filter((r) => r.value === maxScore)
    const losers = results.filter((r) => r.value === minScore)

    echo("Итоги бросков:")
    echo("")

    if (losers.length > 0) {
        if (losers.length === 1) {
            const loser = losers[0]

            echo(`❌ Проиграл(а):`)
            echo(`${loser.user}`)
        } else {
            echo(`❌ Проиграли:`)
            echo(
                `${losers
                    .limit(losers.length - 1)
                    .map((r) => r.user)
                    .join(", ")} и ${losers[losers.length - 1].user}`
            )
            echo(`🤣🤣🤣`)
        }
    } else {
        echo(`❓❓❓ Никто не проиграл ❓❓❓`)
    }

    if (winners.length > 0) {
        if (winners.length === 1) {
            const winner = winners[0]

            echo(`✅ Выйграл(а):`)
            echo(`${winner.user}`)
        } else {
            echo(`✅ Выйграли:`)
            echo(
                `${winners
                    .limit(winners.length - 1)
                    .map((r) => r.user)
                    .join(", ")} и ${winners[winners.length - 1].user}`
            )
            echo(`🎉🎉🎉`)
        }
    } else {
        echo(`❓❓❓ Никто не выйграл ❓❓❓`)
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

module.exports = { BaseUserRolls }
