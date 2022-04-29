const { SlashCommandBuilder } = require("@discordjs/builders")
const { REST } = require("@discordjs/rest")
const { Routes } = require("discord-api-types/v9")

const { DISCORD_TOKEN, APP_ID } = process.env

const rollsCmd = new SlashCommandBuilder()
    .setName("rolls")
    .setDescription(
        "Get random numbers for mentioned members, min 2 members, max 25 members"
    )
    .addUserOption((option) =>
        option
            .setName("member_1")
            .setDescription("Ex: @user1")
            .setRequired(true)
    )
    .addUserOption((option) =>
        option
            .setName("member_2")
            .setDescription("Ex: @user2")
            .setRequired(true)
    )

for (let i = 3; i <= 25; i++) {
    rollsCmd.addUserOption((option) =>
        option
            .setName(`member_${i}`)
            .setDescription(`Ex: @user${i}`)
            .setRequired(false)
    )
}

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with pong!"),
    new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Get random number")
        .addNumberOption((option) =>
            option
                .setName("capacity")
                .setDescription("Overwrite the capacity to random range")
                .setRequired(false)
        ),
    rollsCmd,
].map((command) => command.toJSON())

const rest = new REST({ version: "9" }).setToken(DISCORD_TOKEN)

rest.put(Routes.applicationCommands(APP_ID), { body: commands })
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error)
