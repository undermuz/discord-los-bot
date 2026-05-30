let lastWinners = {}
let lastLosers = {}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 * @returns {number} loose count
 */
function processLoser(interaction, user) {
    if (typeof lastLosers[interaction.channelId] === "undefined") {
        lastLosers[interaction.channelId] = {}
    }

    let looseCount = 0

    if (typeof lastLosers[interaction.channelId][user.id] !== "undefined") {
        lastLosers[interaction.channelId][user.id] =
            lastLosers[interaction.channelId][user.id] + 1

        looseCount = lastLosers[interaction.channelId][user.id]
    } else {
        lastLosers[interaction.channelId][user.id] = 0
    }

    return looseCount
}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 * @returns {number} win count
 */
function processWinner(interaction, user) {
    if (typeof lastWinners[interaction.channelId] === "undefined") {
        lastWinners[interaction.channelId] = {}
    }

    let winCount = 0

    if (typeof lastWinners[interaction.channelId][user.id] !== "undefined") {
        lastWinners[interaction.channelId][user.id] =
            lastWinners[interaction.channelId][user.id] + 1

        winCount = lastWinners[interaction.channelId][user.id]
    } else {
        lastWinners[interaction.channelId][user.id] = 0
    }

    return winCount
}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 */
function dropFromLosers(interaction, user) {
    if (typeof lastLosers[interaction.channelId] === "undefined") {
        return
    }

    if (typeof lastLosers[interaction.channelId][user.id] === "undefined") {
        return
    }

    lastLosers[interaction.channelId][user.id] = undefined
}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 */
function dropFromWinners(interaction, user) {
    if (typeof lastWinners[interaction.channelId] === "undefined") {
        return
    }

    if (typeof lastWinners[interaction.channelId][user.id] === "undefined") {
        return
    }

    lastWinners[interaction.channelId][user.id] = undefined
}

function getStatistics(interaction) {
    let losers = []
    let winners = []

    if (typeof lastWinners[interaction.channelId] !== "undefined") {
        winners = lastWinners[interaction.channelId]
    }

    if (typeof lastLosers[interaction.channelId] !== "undefined") {
        losers = lastLosers[interaction.channelId]
    }

    return { losers, winners }
}

const repeatString = (count, string) => {
    let result = ""

    for (let i = 0; i < count; i++) {
        result += string
    }

    return result
}

const getPostfixText = (count, isLoose = true) => {
    const emoji = isLoose ? [`😡`, `🤬`, `🧨`] : [`👍`, `😎`, `💪`]

    if (count === 0) {
        return ""
    }

    if (count <= 5) {
        let emojiIndex = count - 3

        return (
            repeatString(count, `❗`) +
            (emojiIndex >= 0 ? ` ${emoji[emojiIndex]}` : "")
        )
    }

    if (count === 6) {
        return ` Это баг? x${count}`
    }

    if (count === 7) {
        return ` Зачем? x${count}`
    }

    if (count === 8) {
        return ` Олег? x${count}`
    }

    if (count === 9) {
        return ` Просто не играй x${count}`
    }

    if (count >= 10) {
        return ` x${count} - Нужно ли мне предусматривать вариант под такой результат? Есть ли в этом смысл? Кто нибудь вообще когда либо увидит это сообщение?`
    }

    return " ОПЯТЬ"
}

module.exports = {
    getPostfixText,
    dropFromLosers,
    dropFromWinners,
    processLoser,
    processWinner,
    getStatistics,
}
