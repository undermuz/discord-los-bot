const { Client, Intents } = require("discord.js")

const { DISCORD_TOKEN } = process.env

if (!Array.prototype.limit)
    Array.prototype.limit = function (limit = 0) {
        var self = this

        var _ret = []

        if (limit) {
            for (var i = 0; i < self.length; i++) {
                if (i < limit) {
                    _ret.push(self[i])
                }
            }
        }

        return _ret
    }

function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}
// let t = 0
// function randomIntFromInterval(min, max) {
//     if (t === 0) {
//         t++
//         return 0
//     }

//     if (t === 1) {
//         t++
//         return 99
//     }

//     return 100
// }

const main = async () => {
    const discord = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
    })
    discord.on("ready", () => {
        console.log(`[Main][Discord] Logged in as ${discord.user.tag}!`)
    })

    discord.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return

        const { commandName } = interaction

        console.log("Command", commandName)

        if (commandName === "ping") {
            await interaction.reply("Pong!")
        } else if (commandName === "roll") {
            const texts = [`Бросает ${interaction.user}...`]

            await interaction.reply(texts.join("\n"))

            const cap = interaction.options.getNumber(`capacity`) || 100

            const value = randomIntFromInterval(0, cap)

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
        } else if (commandName === "rolls") {
            const users = []

            for (let i = 1; i <= 25; i++) {
                const user = interaction.options.getUser(`member_${i}`)

                if (user) {
                    users.push(user)
                }
            }

            if (users.length < 2) {
                await interaction.reply(`Ошибка: Минимум игроков 2`)

                return
            }

            const results = users.map((user) => {
                return {
                    user: user,
                    value: randomIntFromInterval(0, 100),
                }
            })

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

                    texts.push(
                        `Выбросил наименьший результат: ${loser.user} 🤣`
                    )
                } else {
                    texts.push(
                        `Выбросили наименьший результат: ${losers
                            .limit(losers.length - 1)
                            .map((r) => r.user)
                            .join(", ")} и ${
                            losers[losers.length - 1].user
                        } 🤣🤣🤣`
                    )
                }
            }

            if (winners.length > 0) {
                if (winners.length === 1) {
                    const winner = winners[0]

                    texts.push(
                        `Выбросил наибольший результат: ${winner.user} 🎉`
                    )
                } else {
                    texts.push(
                        `Выбросили наибольший результат:${winners
                            .limit(winners.length - 1)
                            .map((r) => r.user)
                            .join(", ")} и ${
                            winners[winners.length - 1].user
                        } 🎉🎉🎉`
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
        }
    })

    await discord.login(DISCORD_TOKEN)

    // const guild = await discord.guilds.fetch(guildId)
    // const members = await guild.members.fetch()

    // console.log(members.map((m) => m.toJSON()))
}

main()
