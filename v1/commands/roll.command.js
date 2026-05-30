const { randomIntFromInterval } = require("../utils")

/**
 *
 * @param {import("discord.js").CommandInteraction} interaction
 */
const RollCommand = async (interaction) => {
    const texts = [`Бросает ${interaction.user}...`]

    await interaction.reply(texts.join("\n"))

    const cap = interaction.options.getNumber(`capacity`) || 100

    const value = await randomIntFromInterval(0, cap)

    texts.push(`и выбрасывает ${value}`)

    await interaction.editReply(texts.join("\n"))

    if (value === 0) {
        await interaction.followUp(
            "https://memepedia.ru/wp-content/uploads/2017/04/%D0%B5%D0%B1%D0%B0%D1%82%D1%8C-%D1%82%D1%8B-%D0%BB%D0%BE%D1%85-%D0%BE%D1%80%D0%B8%D0%B3%D0%B8%D0%BD%D0%B0%D0%BB.jpg"
        )
    } else if (value === 99) {
        await interaction.followUp(
            "http://risovach.ru/upload/2013/02/mem/so-close_12108107_orig_.jpeg"
        )
    } else if (value === 100) {
        await interaction.followUp(
            "https://i.ndtvimg.com/i/2015-04/successkid_650x400_51429162983.jpg"
        )
    }

    return
}

module.exports = { RollCommand }
