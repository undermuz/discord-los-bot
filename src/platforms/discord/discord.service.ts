import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    GatewayIntentBits,
    Interaction,
    Partials,
} from "discord.js"
import { replyWithUserError } from "./discord-interaction.util.js"

export type DiscordCommandHandler = (
    interaction: ChatInputCommandInteraction,
) => Promise<void>

export type DiscordAutocompleteHandler = (
    interaction: AutocompleteInteraction,
) => Promise<void>

@Injectable()
export class DiscordService
    implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
    private readonly logger = new Logger(DiscordService.name)
    private readonly commandHandlers = new Map<string, DiscordCommandHandler>()
    private readonly autocompleteHandlers = new Map<
        string,
        DiscordAutocompleteHandler
    >()
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

    registerAutocomplete(
        name: string,
        handler: DiscordAutocompleteHandler,
    ): void {
        this.autocompleteHandlers.set(name, handler)
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

        void this.client.login(token).catch((error: Error) => {
            if (error.message.includes("disallowed intents")) {
                this.logger.error(
                    "Discord rejected bot intents. Enable in Developer Portal → Bot → Privileged Gateway Intents: Server Members Intent (required for roles and /roll-channel).",
                )
            }

            this.logger.error(`Discord login failed: ${error.message}`)
        })
    }

    onModuleDestroy(): void {
        void this.client.destroy()
    }

    private async handleInteraction(interaction: Interaction): Promise<void> {
        if (interaction.isAutocomplete()) {
            await this.handleAutocomplete(interaction)
            return
        }

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
            await replyWithUserError(interaction, {
                error,
                logger: this.logger,
                context: `Command:${interaction.commandName}`,
            })
        }
    }

    private async handleAutocomplete(
        interaction: AutocompleteInteraction,
    ): Promise<void> {
        const handler = this.autocompleteHandlers.get(interaction.commandName)

        if (!handler) {
            return
        }

        try {
            await handler(interaction)
        } catch (error) {
            this.logger.error(
                `Autocomplete failed for ${interaction.commandName}`,
                error instanceof Error ? error.stack : String(error),
            )

            if (!interaction.responded) {
                await interaction.respond([])
            }
        }
    }
}
