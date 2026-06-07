import { Injectable } from "@nestjs/common"
import { LeaderboardGuildConfig } from "../../database/entities/leaderboard-guild-config.entity.js"
import { RatingTierRole } from "../../database/entities/rating-tier-role.entity.js"
import { PlayerRoleState, RoleSyncPlan } from "./types.js"

@Injectable()
export class LeaderboardRoleService {
    resolveRolePlan(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
        state: PlayerRoleState,
    ): RoleSyncPlan {
        const managedRoleIds = this.collectManagedRoleIds(config, tiers)
        const targetRoleId = this.resolveTargetRoleId(config, tiers, state)

        return {
            removeRoleIds: managedRoleIds.filter(
                (roleId) => roleId !== targetRoleId,
            ),
            addRoleId:
                targetRoleId && !managedRoleIds.includes(targetRoleId)
                    ? null
                    : targetRoleId,
        }
    }

    buildRoleSyncPlan(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
        state: PlayerRoleState,
        currentRoleIds: string[],
    ): RoleSyncPlan {
        const managedRoleIds = this.collectManagedRoleIds(config, tiers)
        const targetRoleId = this.resolveTargetRoleId(config, tiers, state)

        const removeRoleIds = managedRoleIds.filter((roleId) =>
            currentRoleIds.includes(roleId),
        )

        const addRoleId =
            targetRoleId && !currentRoleIds.includes(targetRoleId)
                ? targetRoleId
                : null

        if (
            targetRoleId &&
            removeRoleIds.includes(targetRoleId) &&
            addRoleId === targetRoleId
        ) {
            return {
                removeRoleIds: removeRoleIds.filter(
                    (roleId) => roleId !== targetRoleId,
                ),
                addRoleId: null,
            }
        }

        return { removeRoleIds, addRoleId }
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

    private resolveTargetRoleId(
        config: LeaderboardGuildConfig,
        tiers: RatingTierRole[],
        state: PlayerRoleState,
    ): string | null {
        if (state.isFrozen) {
            return config.freezeRoleId
        }

        if (state.totalVerifiedMatches < config.calibrationMatchThreshold) {
            return config.calibrationRoleId
        }

        if (state.mainRating < 700) {
            return null
        }

        return this.resolveTier(tiers, state.mainRating)?.roleId ?? null
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
