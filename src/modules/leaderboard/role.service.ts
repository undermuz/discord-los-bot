import { Injectable } from "@nestjs/common"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import { RatingTierRole } from "../../database/entities/rating-tier-role.entity.js"
import { formatRating } from "./rating.util.js"
import { PlayerRoleState, RoleSyncPlan, RoleSyncRemoval } from "./types.js"

@Injectable()
export class LeaderboardRoleService {
    buildRoleSyncPlan(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
        state: PlayerRoleState,
        currentRoleIds: string[],
    ): RoleSyncPlan {
        const managedRoleIds = this.collectManagedRoleIds(config, tiers)
        const target = this.describeTargetRole(config, tiers, state)
        const removeReason = this.buildRemovalReason(target.reason)

        const removeRoleIds = managedRoleIds
            .filter(
                (roleId) =>
                    currentRoleIds.includes(roleId) && roleId !== target.roleId,
            )
            .map(
                (roleId): RoleSyncRemoval => ({
                    roleId,
                    reason: removeReason,
                }),
            )

        const addRoleId =
            target.roleId && !currentRoleIds.includes(target.roleId)
                ? target.roleId
                : null

        if (removeRoleIds.length === 0 && addRoleId === null) {
            return {
                removeRoleIds: [],
                addRoleId: null,
                addReason: null,
                unchangedReason: this.buildUnchangedReason(
                    target,
                    currentRoleIds,
                ),
            }
        }

        return {
            removeRoleIds,
            addRoleId,
            addReason: addRoleId ? target.reason : null,
            unchangedReason: null,
        }
    }

    resolveTier(
        tiers: RatingTierRole[],
        mainRating: number,
    ): RatingTierRole | null {
        for (const tier of tiers) {
            if (tier.maxRating === null) {
                if (mainRating >= tier.minRating) {
                    return tier
                }
                continue
            }

            if (mainRating >= tier.minRating && mainRating < tier.maxRating) {
                return tier
            }
        }

        return null
    }

    private describeTargetRole(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
        state: PlayerRoleState,
    ): { roleId: string | null; reason: string } {
        if (state.isFrozen) {
            return {
                roleId: config.freezeRoleId,
                reason: "player is frozen",
            }
        }

        if (state.totalVerifiedMatches < config.calibrationMatchThreshold) {
            return {
                roleId: config.calibrationRoleId,
                reason: `calibration (${state.totalVerifiedMatches}/${config.calibrationMatchThreshold} verified matches)`,
            }
        }

        if (state.mainRating < 700) {
            return {
                roleId: null,
                reason: `rating ${formatRating(state.mainRating)} is below 700, no rank role`,
            }
        }

        const tier = this.resolveTier(tiers, state.mainRating)

        if (!tier) {
            return {
                roleId: null,
                reason: `rating ${formatRating(state.mainRating)} does not match any configured tier`,
            }
        }

        return {
            roleId: tier.roleId,
            reason: `tier "${tier.name}" (rating ${formatRating(state.mainRating)})`,
        }
    }

    private buildRemovalReason(targetReason: string): string {
        return `outdated managed role, target state is ${targetReason}`
    }

    private buildUnchangedReason(
        target: { roleId: string | null; reason: string },
        currentRoleIds: string[],
    ): string {
        if (target.roleId && currentRoleIds.includes(target.roleId)) {
            return `already has the correct role (${target.reason})`
        }

        return `no changes needed (${target.reason})`
    }

    private collectManagedRoleIds(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
    ): string[] {
        const roleIds = [
            config.calibrationRoleId,
            config.freezeRoleId,
            ...tiers.map((tier) => tier.roleId),
        ]

        return roleIds.filter((roleId): roleId is string => Boolean(roleId))
    }
}
