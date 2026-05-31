import { Logger } from "@nestjs/common"
import {
    ChatInputCommandInteraction,
    InteractionReplyOptions,
    MessageFlags,
} from "discord.js"

export const DISCORD_USER_ERROR_MESSAGE = "Произошла ошибка"

export async function replyWithUserError(
    interaction: ChatInputCommandInteraction,
    options?: {
        error?: unknown
        logger?: Logger
        context?: string
    },
): Promise<void> {
    const { error, logger, context } = options ?? {}

    if (logger && error !== undefined) {
        const prefix = context ? `[${context}] ` : ""
        logger.error(
            `${prefix}${error instanceof Error ? error.message : error}`,
        )

        if (error instanceof Error && error.stack) {
            logger.error(error.stack)
        }
    }

    const payload: InteractionReplyOptions = {
        content: DISCORD_USER_ERROR_MESSAGE,
        flags: MessageFlags.Ephemeral,
    }

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload)
        } else {
            await interaction.reply(payload)
        }
    } catch (replyError) {
        logger?.error(
            replyError instanceof Error ? replyError.message : replyError,
        )
    }
}
