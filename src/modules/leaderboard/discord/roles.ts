import { Injectable, Logger } from "@nestjs/common"
import { GuildMember, PermissionFlagsBits, Role } from "discord.js"
import { LeaderboardService } from "../leaderboard.service.js"

type RoleManageCheck =
    | { allowed: true }
    | { allowed: false; reason: string }

@Injectable()
export class LeaderboardDiscordRoles {
    private readonly logger = new Logger(LeaderboardDiscordRoles.name)

    constructor(private readonly leaderboardService: LeaderboardService) {}

    async syncMemberRoles(member: GuildMember): Promise<void> {
        const me = await member.guild.members.fetchMe()
        const memberLabel = `${member.user.tag} (${member.id})`
        const currentRoleIds = member.roles.cache.map((role) => role.id)
        const plan = await this.leaderboardService.buildRoleSyncPlan(
            member.guild.id,
            member.id,
            currentRoleIds,
        )

        if (plan.unchangedReason) {
            this.logger.log(
                `Role sync for ${memberLabel}: no changes, ${plan.unchangedReason}`,
            )
            return
        }

        for (const removal of plan.removeRoleIds) {
            const roleLabel = this.formatRoleLabel(member, removal.roleId)
            const check = this.canManageRole(member, me, removal.roleId)

            if (!check.allowed) {
                this.logger.warn(
                    `Role sync for ${memberLabel}: skipped removing ${roleLabel}, ${check.reason}; removal reason: ${removal.reason}`,
                )
                continue
            }

            try {
                await member.roles.remove(removal.roleId)
                this.logger.log(
                    `Role sync for ${memberLabel}: removed ${roleLabel}, ${removal.reason}`,
                )
            } catch (error) {
                this.logRoleError("remove", member, removal.roleId, error)
            }
        }

        if (!plan.addRoleId) {
            return
        }

        const roleLabel = this.formatRoleLabel(member, plan.addRoleId)
        const check = this.canManageRole(member, me, plan.addRoleId)

        if (!check.allowed) {
            this.logger.warn(
                `Role sync for ${memberLabel}: skipped adding ${roleLabel}, ${check.reason}; intended reason: ${plan.addReason}`,
            )
            return
        }

        try {
            await member.roles.add(plan.addRoleId)
            this.logger.log(
                `Role sync for ${memberLabel}: added ${roleLabel}, ${plan.addReason}`,
            )
        } catch (error) {
            this.logRoleError("add", member, plan.addRoleId, error)
        }
    }

    async syncMembers(
        guildId: string,
        userIds: string[],
        fetchMember: (userId: string) => Promise<GuildMember | null>,
    ): Promise<void> {
        for (const userId of userIds) {
            const member = await fetchMember(userId)

            if (!member) {
                this.logger.warn(
                    `Role sync: member ${userId} not found in guild ${guildId}`,
                )
                continue
            }

            await this.syncMemberRoles(member)
        }
    }

    private canManageRole(
        member: GuildMember,
        me: GuildMember,
        roleId: string,
    ): RoleManageCheck {
        const role = member.guild.roles.cache.get(roleId)

        if (!role) {
            const reason = `role ${roleId} not found in guild ${member.guild.id}`
            this.logger.warn(reason)
            return { allowed: false, reason }
        }

        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const reason = `missing Manage Roles permission in guild ${member.guild.name}`
            this.logger.error(reason)
            return { allowed: false, reason }
        }

        if (role.managed) {
            const reason = `role "${role.name}" is managed by an integration and cannot be assigned manually`
            this.logger.error(reason)
            return { allowed: false, reason }
        }

        if (!role.editable) {
            const reason = this.buildHierarchyHint(role)
            this.logger.error(reason)
            return { allowed: false, reason }
        }

        if (!member.manageable) {
            const reason = this.buildMemberHierarchyHint(member, me)
            this.logger.error(reason)
            return { allowed: false, reason }
        }

        return { allowed: true }
    }

    private formatRoleLabel(member: GuildMember, roleId: string): string {
        const role = member.guild.roles.cache.get(roleId)
        return role ? `"${role.name}"` : roleId
    }

    private buildMemberHierarchyHint(
        member: GuildMember,
        me: GuildMember,
    ): string {
        const memberHighest = member.roles.highest
        const botHighest = me.roles.highest
        const ownerNote =
            member.user.id === member.guild.ownerId
                ? ", member is the guild owner"
                : ""

        return (
            `member highest role "${memberHighest.name}" (position ${memberHighest.position}) ` +
            `is above or equal to bot highest role "${botHighest.name}" (position ${botHighest.position})` +
            ownerNote
        )
    }

    private buildHierarchyHint(role: Role): string {
        return (
            `bot role is not high enough to manage "${role.name}" ` +
            "(move the bot role above it in Server Settings → Roles)"
        )
    }

    private logRoleError(
        action: "add" | "remove",
        member: GuildMember,
        roleId: string,
        error: unknown,
    ): void {
        const roleLabel = this.formatRoleLabel(member, roleId)

        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === 50001
        ) {
            const role = member.guild.roles.cache.get(roleId)
            this.logger.error(
                role
                    ? `Role sync for ${member.user.tag}: failed to ${action} ${roleLabel}, ${this.buildHierarchyHint(role)}`
                    : `Role sync for ${member.user.tag}: failed to ${action} ${roleLabel}, missing access`,
            )
            return
        }

        this.logger.error(
            `Role sync for ${member.user.tag}: failed to ${action} ${roleLabel}`,
            error instanceof Error ? error.stack : String(error),
        )
    }
}
