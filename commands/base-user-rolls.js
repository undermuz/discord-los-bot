const { rollUsers } = require("../utils")
const { getReaction } = require("./reactions")
const {
    dropFromLosers,
    dropFromWinners,
    processLoser,
    processWinner,
    getStatistics,
} = require("./statistics")

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
        let r = `${res.value}`

        if (r.length === 1) r = `  ${r}`
        if (r.length === 2) r = ` ${r}`

        echo(`***${res.value}*** --------- ${res.user}`)

        await interaction.editReply(texts.join("\n"))
    }

    echo("")

    const winners = results.filter((r) => r.value === maxScore)
    const losers = results.filter((r) => r.value === minScore)

    for (const user of users) {
        const winner = winners.find((w) => w.user === user)
        const loser = losers.find((w) => w.user === user)

        if (!loser) {
            dropFromLosers(interaction, user)
        }

        if (!winner) {
            dropFromWinners(interaction, user)
        }
    }

    echo("Итоги бросков:")
    echo("")

    const getPostfixText = (count, isLoose = true) => {
        const emoji = isLoose ? [`😡`, `🤬`, `🧨`] : [`👍`, `😎`, `💪`]

        if (count === 1) {
            return ` ОПЯТЬ`
        } else if (count > 1 && count <= 2) {
            return ` ОПЯТЬ x${count}`
        } else if (count === 3) {
            return ` ОПЯТЬ??? x${count} ${emoji[0]}`
        } else if (count === 4) {
            return ` КАК?? ОПЯТЬ??? x${count} ${emoji[1]}`
        } else if (count === 5) {
            return ` ПЯТЬ РАЗ ПОДРЯД??? ${emoji[2]}`
        } else if (count > 5) {
            return ` Это баг? x${count}`
        }

        return ""
    }

    if (losers.length > 0) {
        if (losers.length === 1) {
            const loser = losers[0]

            const looseCount = processLoser(interaction, loser.user)
            const postfix = getPostfixText(looseCount, true)

            echo(`❌ ${loser.user} - проиграл(а)${postfix}`)
        } else {
            const getUserTitle = (user) => {
                const looseCount = processLoser(interaction, user)

                const postfix = getPostfixText(looseCount, true)

                return `${user}${postfix}`
            }

            echo(`❌ Проиграли:`)
            echo(
                `${losers
                    .limit(losers.length - 1)
                    .map((r) => getUserTitle(r.user))
                    .join(", ")} и ${getUserTitle(
                    losers[losers.length - 1].user
                )}`
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

            const winCount = processWinner(interaction, winner.user)
            const postfix = getPostfixText(winCount, false)

            echo(`✅ ${winner.user} - выиграл(а)${postfix}`)
        } else {
            const getUserTitle = (user) => {
                const winCount = processWinner(interaction, user)

                const postfix = getPostfixText(winCount, false)

                return `${user}${postfix}`
            }

            echo(`✅ Выиграли:`)
            echo(
                `${winners
                    .limit(winners.length - 1)
                    .map((r) => getUserTitle(r.user))
                    .join(", ")} и ${getUserTitle(
                    winners[winners.length - 1].user
                )}`
            )
            echo(`🎉🎉🎉`)
        }
    } else {
        echo(`❓❓❓ Никто не выиграл ❓❓❓`)
    }

    console.log(
        `[Discord][Rolls][Statistics: ${interaction.channelId}]`,
        getStatistics(interaction)
    )

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
