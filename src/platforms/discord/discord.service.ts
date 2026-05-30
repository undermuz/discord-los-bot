import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
    ChatInputCommandInteraction,
    Client,
    GatewayIntentBits,
    Interaction,
    Partials,
} from "discord.js"

export type DiscordCommandHandler = (
    interaction: ChatInputCommandInteraction,
) => Promise<void>

@Injectable()
export class DiscordService
    implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(DiscordService.name)
    private readonly commandHandlers = new Map<string, DiscordCommandHandler>()
    readonly client: Client

    constructor(private readonly configService: ConfigService) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction],
        })
    }

    registerCommand(name: string, handler: DiscordCommandHandler): void {
        this.commandHandlers.set(name, handler)
    }

    onModuleInit(): void {
        this.client.once("ready", () => {
            this.logger.log(`Logged in as ${this.client.user?.tag}`)
        })

        this.client.on("interactionCreate", (interaction) => {
            void this.handleInteraction(interaction)
        })
    }

    onApplicationBootstrap(): void {
        const token = this.configService.get<string>("app.discordToken")

        if (!token) {
            this.logger.error("DISCORD_TOKEN is not set")
            return
        }

        void this.client.login(token)
    }

    onModuleDestroy(): void {
        void this.client.destroy()
    }

    private async handleInteraction(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) {
            return
        }

        const handler = this.commandHandlers.get(interaction.commandName)

        if (!handler) {
            return
        }

        try {
            await handler(interaction)
        } catch (error) {
            this.logger.error(
                `[Command:${interaction.commandName}] ${error instanceof Error ? error.message : error}`,
            )

            if (error instanceof Error) {
                this.logger.error(error.stack)
            }

            const content = `Ошибка: ${error instanceof Error ? error.message : "Unknown error"}`

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, ephemeral: true })
            } else {
                await interaction.reply({ content, ephemeral: true })
            }
        }
    }
}
