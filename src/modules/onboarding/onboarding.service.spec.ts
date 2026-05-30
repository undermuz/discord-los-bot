import { beforeEach, describe, expect, it } from "vitest"
import { createMockRepository } from "../../../test/helpers/typeorm.mock.js"
import { EmojiToRole } from "../../database/entities/emoji-to-role.entity.js"
import { OnboardingService } from "./onboarding.service.js"

describe("OnboardingService", () => {
    let service: OnboardingService
    let repository: ReturnType<typeof createMockRepository<EmojiToRole>>

    beforeEach(() => {
        repository = createMockRepository<EmojiToRole>()
        service = new OnboardingService(repository)
    })

    describe("createRule", () => {
        it("creates and returns a new rule", async () => {
            repository.findOne.mockResolvedValue(null)
            repository.save.mockResolvedValue({
                id: 1,
                guildId: "g1",
                roleId: "r1",
                emoji: "👍",
                messageId: "m1",
                removeAllRoles: false,
            })

            const result = await service.createRule({
                guildId: "g1",
                roleId: "r1",
                emoji: "👍",
                messageId: "m1",
                removeAllRoles: false,
            })

            expect(result).toEqual({
                id: 1,
                guildId: "g1",
                roleId: "r1",
                emoji: "👍",
                messageId: "m1",
                removeAllRoles: false,
            })
            expect(repository.save).toHaveBeenCalled()
        })

        it("throws when duplicate rule exists", async () => {
            repository.findOne.mockResolvedValue({ id: 1 })

            await expect(
                service.createRule({
                    guildId: "g1",
                    roleId: "r1",
                    emoji: "👍",
                    messageId: "m1",
                    removeAllRoles: false,
                }),
            ).rejects.toThrow("Such rule already exists")
        })
    })

    describe("deleteRulesByMessageId", () => {
        it("deletes rules and returns count", async () => {
            repository.find.mockResolvedValue([{ id: 1 }, { id: 2 }])
            repository.delete.mockResolvedValue({ affected: 2, raw: [] })

            await expect(
                service.deleteRulesByMessageId("g1", "m1"),
            ).resolves.toBe(2)
            expect(repository.delete).toHaveBeenCalledWith({
                guildId: "g1",
                messageId: "m1",
            })
        })

        it("throws when no rules found", async () => {
            repository.find.mockResolvedValue([])

            await expect(
                service.deleteRulesByMessageId("g1", "m1"),
            ).rejects.toThrow("No exchange rules found for this message")
        })
    })

    describe("findRule", () => {
        it("returns mapped rule when found", async () => {
            repository.findOne.mockResolvedValue({
                id: 1,
                guildId: "g1",
                roleId: "r1",
                emoji: "👍",
                messageId: "m1",
                removeAllRoles: false,
            })

            await expect(service.findRule("g1", "m1", "👍")).resolves.toEqual({
                id: 1,
                guildId: "g1",
                roleId: "r1",
                emoji: "👍",
                messageId: "m1",
                removeAllRoles: false,
            })
        })

        it("returns null when not found", async () => {
            repository.findOne.mockResolvedValue(null)
            await expect(service.findRule("g1", "m1", "👍")).resolves.toBeNull()
        })
    })

    describe("shouldGrantRole", () => {
        it("returns true when member does not have role", () => {
            expect(
                service.shouldGrantRole(
                    {
                        id: 1,
                        guildId: "g1",
                        roleId: "r1",
                        emoji: "👍",
                        messageId: "m1",
                        removeAllRoles: false,
                    },
                    false,
                ),
            ).toBe(true)
        })

        it("returns false when member already has role", () => {
            expect(
                service.shouldGrantRole(
                    {
                        id: 1,
                        guildId: "g1",
                        roleId: "r1",
                        emoji: "👍",
                        messageId: "m1",
                        removeAllRoles: false,
                    },
                    true,
                ),
            ).toBe(false)
        })
    })

    describe("getRoleRemovalPlan", () => {
        const rule = {
            id: 1,
            guildId: "g1",
            roleId: "r1",
            emoji: "👍",
            messageId: "m1",
            removeAllRoles: false,
        }

        it("returns all roles when removeAllRoles is true", () => {
            expect(
                service.getRoleRemovalPlan({ ...rule, removeAllRoles: true }, [
                    "r1",
                    "r2",
                    "@everyone",
                ]),
            ).toEqual(["r1", "r2", "@everyone"])
        })

        it("returns single mapped role when member has it", () => {
            expect(service.getRoleRemovalPlan(rule, ["r1", "r2"])).toEqual([
                "r1",
            ])
        })

        it("returns empty array when member does not have mapped role", () => {
            expect(service.getRoleRemovalPlan(rule, ["r2"])).toEqual([])
        })
    })
})
