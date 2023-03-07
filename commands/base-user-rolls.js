const { MessageAttachment } = require("discord.js")
const { rollUsers } = require("../utils")
const { getReaction } = require("./reactions")

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

            echo(`❌ ${loser.user} - проиграл(а)`)
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

    echo("")

    if (winners.length > 0) {
        if (winners.length === 1) {
            const winner = winners[0]

            echo(`✅ ${winner.user} - выйграл(а)`)
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
        const attachment = getReaction(res.value)

        if (attachment === null) {
            continue
        }

        await interaction.followUp({
            content: `${res.user}`,
            files: [attachment],
        })
    }
}

module.exports = { BaseUserRolls }
