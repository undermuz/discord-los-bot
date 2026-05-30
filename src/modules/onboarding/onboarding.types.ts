export interface CreateEmojiToRoleDto {
    guildId: string
    roleId: string
    emoji: string
    messageId: string
    removeAllRoles: boolean
}

export interface EmojiToRoleRule {
    id: number
    guildId: string
    roleId: string
    emoji: string
    messageId: string
    removeAllRoles: boolean
}
