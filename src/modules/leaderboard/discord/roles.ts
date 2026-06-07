import { Injectable, Logger } from "@nestjs/common"
import { GuildMember, PermissionFlagsBits, Role } from "discord.js"
import { LeaderboardService } from "../leaderboard.service.js"

@Injectable()
export class LeaderboardDiscordRoles {
    private readonly logger = new Logger(LeaderboardDiscordRoles.name)

    constructor(private readonly leaderboardService: LeaderboardService) {}

    async syncMemberRoles(member: GuildMember): Promise<void> {
        const currentRoleIds = member.roles.cache.map((role) => role.id)
        const plan = await this.leaderboardService.buildRoleSyncPlan(
            member.guild.id,
            member.id,
            currentRoleIds,
        )

        for (const roleId of plan.removeRoleIds) {
            if (!this.canManageRole(member, roleId)) {
                continue
            }

            try {
                await member.roles.remove(roleId)
            } catch (error) {
                this.logRoleError("remove", member, roleId, error)
            }
        }

        if (plan.addRoleId) {
            if (!this.canManageRole(member, plan.addRoleId)) {
                return
            }

            try {
                await member.roles.add(plan.addRoleId)
            } catch (error) {
                this.logRoleError("add", member, plan.addRoleId, error)
                return
            }
        }

        this.logger.log(`Synced leaderboard roles for ${member.id}`)
    }

    async syncMembers(
        guildId: string,
        userIds: string[],
        fetchMember: (userId: string) => Promise<GuildMember | null>,
    ): Promise<void> {
        for (const userId of userIds) {
            const member = await fetchMember(userId)

            if (!member) {
                continue
            }

            await this.syncMemberRoles(member)
        }
    }

    private canManageRole(member: GuildMember, roleId: string): boolean {
        const role = member.guild.roles.cache.get(roleId)
        const me = member.guild.members.me

        if (!role) {
            this.logger.warn(
                `Role ${roleId} not found in guild ${member.guild.id}`,
            )
            return false
        }

        if (!me) {
            this.logger.error("Bot member is unavailable in guild cache")
            return false
        }

        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            this.logger.error(
                `Missing Manage Roles permission in guild ${member.guild.name}`,
            )
            return false
        }

        if (role.managed) {
            this.logger.error(
                `Role "${role.name}" is managed by an integration and cannot be assigned manually`,
            )
            return false
        }

        if (!role.editable) {
            this.logger.error(this.buildHierarchyHint(role))
            return false
        }

        if (
            member.id !== me.id &&
            member.roles.highest.position >= me.roles.highest.position
        ) {
            this.logger.error(
                `Cannot change roles for ${member.user.tag}: member role is above or equal to the bot role`,
            )
            return false
        }

        return true
    }

    private buildHierarchyHint(role: Role): string {
        return (
            `Cannot manage role "${role.name}": move the bot role above "${role.name}" ` +
            "in Server Settings → Roles, and ensure the bot has Manage Roles permission"
        )
    }

    private logRoleError(
        action: "add" | "remove",
        member: GuildMember,
        roleId: string,
        error: unknown,
    ): void {
        const role = member.guild.roles.cache.get(roleId)
        const roleLabel = role ? `"${role.name}"` : roleId

        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === 50001
        ) {
            const me = member.guild.members.me
            this.logger.error(
                role
                    ? this.buildHierarchyHint(role)
                    : `Missing Access while trying to ${action} role ${roleLabel} for ${member.user.tag}`,
            )
            return
        }

        this.logger.error(
            `Failed to ${action} role ${roleLabel} for ${member.user.tag}`,
            error instanceof Error ? error.stack : String(error),
        )
    }
}
