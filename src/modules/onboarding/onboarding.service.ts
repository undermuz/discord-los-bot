import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { EmojiToRole } from "../../database/entities/emoji-to-role.entity.js"
import { CreateEmojiToRoleDto, EmojiToRoleRule } from "./onboarding.types.js"

@Injectable()
export class OnboardingService {
    constructor(
        @InjectRepository(EmojiToRole)
        private readonly emojiToRoleRepository: Repository<EmojiToRole>,
    ) {}

    async createRule(dto: CreateEmojiToRoleDto): Promise<EmojiToRoleRule> {
        const existing = await this.emojiToRoleRepository.findOne({
            where: {
                guildId: dto.guildId,
                roleId: dto.roleId,
                emoji: dto.emoji,
                messageId: dto.messageId,
            },
        })

        if (existing) {
            throw new Error("Such rule already exists")
        }

        const saved = await this.emojiToRoleRepository.save(
            this.emojiToRoleRepository.create(dto),
        )

        return this.toRule(saved)
    }

    async deleteRulesByMessageId(
        guildId: string,
        messageId: string,
    ): Promise<number> {
        const rules = await this.emojiToRoleRepository.find({
            where: { guildId, messageId },
        })

        if (rules.length === 0) {
            throw new Error("No exchange rules found for this message")
        }

        await this.emojiToRoleRepository.delete({ guildId, messageId })
        return rules.length
    }

    async findRule(
        guildId: string,
        messageId: string,
        emoji: string,
    ): Promise<EmojiToRoleRule | null> {
        const rule = await this.emojiToRoleRepository.findOne({
            where: { guildId, messageId, emoji },
        })

        return rule ? this.toRule(rule) : null
    }

    shouldGrantRole(rule: EmojiToRoleRule, hasRole: boolean): boolean {
        return !hasRole
    }

    getRoleRemovalPlan(
        rule: EmojiToRoleRule,
        memberRoleIds: string[],
    ): string[] {
        if (rule.removeAllRoles) {
            return memberRoleIds
        }

        if (!memberRoleIds.includes(rule.roleId)) {
            return []
        }

        return [rule.roleId]
    }

    private toRule(entity: EmojiToRole): EmojiToRoleRule {
        return {
            id: entity.id,
            guildId: entity.guildId,
            roleId: entity.roleId,
            emoji: entity.emoji,
            messageId: entity.messageId,
            removeAllRoles: entity.removeAllRoles,
        }
    }
}
