const { randomInt } = require("node:crypto")

async function randomIntFromInterval(min, max) {
    // Old
    // return Math.floor(Math.random() * (max - min + 1) + min)

    return new Promise((resolve, rejects) => {
        randomInt(min, max, (err, n) => {
            if (err) {
                rejects(err)
                return
            }

            resolve(n)
        })
    })
}

async function rollUsers(users, cap = 100) {
    const results = []

    for (const user of users) {
        const value = await randomIntFromInterval(0, cap)

        results.push({
            user,
            value,
        })
    }

    return results
}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {Error} error
 */
const processError = async (interaction, error) => {
    const { commandName } = interaction

    try {
        console.error(
            `[Discord][on: Command][${commandName}][Error]`,
            error?.message
        )
        console.error(error)

        await interaction.reply(`Ошибка: ${error?.message}`)
    } catch (fatalError) {
        console.error(
            `[Discord][on: Command][${commandName}][FatalError]`,
            fatalError?.message
        )
        console.error(fatalError)
    }
}

module.exports = { rollUsers, randomIntFromInterval, processError }
