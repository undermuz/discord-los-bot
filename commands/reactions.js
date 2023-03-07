const { MessageAttachment } = require("discord.js")

function getReaction(value) {
    if (value === 0) {
        return new MessageAttachment(
            "https://memepedia.ru/wp-content/uploads/2017/04/%D0%B5%D0%B1%D0%B0%D1%82%D1%8C-%D1%82%D1%8B-%D0%BB%D0%BE%D1%85-%D0%BE%D1%80%D0%B8%D0%B3%D0%B8%D0%BD%D0%B0%D0%BB.jpg"
        )
    }

    if (value === 99) {
        return new MessageAttachment(
            "http://risovach.ru/upload/2013/02/mem/so-close_12108107_orig_.jpeg"
        )
    }

    if (value === 100) {
        return new MessageAttachment(
            "https://i.ndtvimg.com/i/2015-04/successkid_650x400_51429162983.jpg"
        )
    }

    return null
}

module.exports = { getReaction }
