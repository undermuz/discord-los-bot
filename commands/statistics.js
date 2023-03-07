let lastWinners = {}
let lastLosers = {}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 * @returns {number} loose count
 */
function processLoser(interaction, user) {
    if (!lastLosers[interaction.channelId]) {
        lastLosers[interaction.channelId] = {}
    }

    let looseCount = 0

    if (lastLosers[interaction.channelId][user.id]) {
        looseCount = lastLosers[interaction.channelId][user.id]

        lastLosers[interaction.channelId][user.id] =
            lastLosers[interaction.channelId][user.id] + 1
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
    if (!lastWinners[interaction.channelId]) {
        lastWinners[interaction.channelId] = {}
    }

    let winCount = 0

    if (lastWinners[interaction.channelId][user.id]) {
        winCount = lastWinners[interaction.channelId][user.id]

        lastWinners[interaction.channelId][user.id] =
            lastWinners[interaction.channelId][user.id] + 1
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
    if (!lastLosers[interaction.channelId]) {
        return
    }

    if (!lastLosers[interaction.channelId][user.id]) {
        return
    }

    lastLosers[interaction.channelId][user.id] = 0
}

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 * @param {import("discord.js").User} user
 */
function dropFromWinners(interaction, user) {
    if (!lastWinners[interaction.channelId]) {
        return
    }

    if (!lastWinners[interaction.channelId][user.id]) {
        return
    }

    lastWinners[interaction.channelId][user.id] = 0
}

function getStatistics(interaction) {
    let losers = []
    let winners = []

    if (lastWinners[interaction.channelId]) {
        winners = lastWinners[interaction.channelId]
    }

    if (lastLosers[interaction.channelId]) {
        losers = lastLosers[interaction.channelId]
    }

    return { losers, winners }
}

module.exports = {
    dropFromLosers,
    dropFromWinners,
    processLoser,
    processWinner,
    getStatistics,
}
