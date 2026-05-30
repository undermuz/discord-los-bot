import { Injectable, OnModuleInit } from "@nestjs/common"
import { ChannelType, ChatInputCommandInteraction, User } from "discord.js"
import { randomIntFromInterval } from "../../../common/utils/random.util.js"
import { DiscordService } from "../../../platforms/discord/discord.service.js"
import { RollingService } from "../rolling.service.js"
import { RollingDiscordPresenter } from "./rolling.discord.presenter.js"

@Injectable()
export class RollingDiscordCommands implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly rollingService: RollingService,
        private readonly presenter: RollingDiscordPresenter,
    ) {}

    onModuleInit(): void {
        this.discordService.registerCommand("roll", (interaction) =>
            this.handleRoll(interaction),
        )

        this.discordService.registerCommand("rolls", (interaction) =>
            this.handleRolls(interaction),
        )

        this.discordService.registerCommand("roll-channel", (interaction) =>
            this.handleRollChannel(interaction),
        )
    }

    private async handleRoll(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const texts = [`Бросает ${interaction.user.toString()}...`]

        await interaction.reply(texts.join("\n"))

        const cap = interaction.options.getNumber("capacity") ?? 100
        const value = await randomIntFromInterval(0, cap)

        texts.push(`и выбрасывает ${value}`)
        await interaction.editReply(texts.join("\n"))

        const asset = this.rollingService.getReactionAsset(value)

        if (asset) {
            await interaction.followUp(asset.url)
        }
    }

    private async handleRolls(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const users = this.collectMentionedUsers(interaction)

        if (users.length < 2) {
            await interaction.reply("Ошибка: Минимум игроков 2")
            return
        }

        await this.presenter.renderMultiUserRoll(interaction, users)
    }

    private async handleRollChannel(
        interaction: ChatInputCommandInteraction,
    ): Promise<void> {
        const channel = interaction.options.getChannel("roll_channel", true)

        if (channel.type !== ChannelType.GuildVoice) {
            await interaction.reply("Ошибка: Канал должен быть голосовым")
            return
        }

        const excludedUsers = this.collectExcludedUsers(interaction)
        const users: User[] = []

        if ("members" in channel) {
            channel.members.forEach((member) => {
                if (excludedUsers.some((user) => user.id === member.user.id)) {
                    return
                }

                users.push(member.user)
            })
        }

        if (users.length < 2) {
            await interaction.reply("Ошибка: Минимум игроков 2")
            return
        }

        if (users.length > 25) {
            await interaction.reply("Ошибка: Максимум игроков 25")
            return
        }

        await this.presenter.renderMultiUserRoll(interaction, users)
    }

    private collectMentionedUsers(
        interaction: ChatInputCommandInteraction,
    ): User[] {
        const users: User[] = []

        for (let i = 1; i <= 25; i++) {
            const user = interaction.options.getUser(`member_${i}`)

            if (user) {
                users.push(user)
            }
        }

        return users
    }

    private collectExcludedUsers(
        interaction: ChatInputCommandInteraction,
    ): User[] {
        const users: User[] = []

        for (let i = 1; i <= 25; i++) {
            const user = interaction.options.getUser(`exclude_member_${i}`)

            if (user) {
                users.push(user)
            }
        }

        return users
    }
}
