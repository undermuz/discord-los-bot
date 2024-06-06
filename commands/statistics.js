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
    } else if (count === 6) {
        return ` Это баг? x${count}`
    } else if (count === 7) {
        return ` Зачем? x${count}`
    } else if (count === 8) {
        return ` Олег? x${count}`
    } else if (count === 9) {
        return ` ... x${count}`
    } else if (count >= 10) {
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
