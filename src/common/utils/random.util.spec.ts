import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:crypto", () => ({
    randomInt: vi.fn(
        (
            _min: number,
            _max: number,
            callback: (error: Error | null, value?: number) => void,
        ) => {
            callback(null, 42)
        },
    ),
}))

import { randomInt } from "node:crypto"
import { randomIntFromInterval } from "./random.util.js"

describe("randomIntFromInterval", () => {
    afterEach(() => {
        vi.mocked(randomInt).mockImplementation(
            (
                _min: number,
                _max: number,
                callback: (error: Error | null, value?: number) => void,
            ) => {
                callback(null, 42)
            },
        )
    })

    it("returns value from crypto.randomInt callback", async () => {
        await expect(randomIntFromInterval(0, 100)).resolves.toBe(42)
        expect(randomInt).toHaveBeenCalledWith(0, 100, expect.any(Function))
    })

    it("rejects when crypto.randomInt returns error", async () => {
        const error = new Error("random failed")

        vi.mocked(randomInt).mockImplementation(
            (
                _min: number,
                _max: number,
                callback: (error: Error | null, value?: number) => void,
            ) => {
                callback(error)
            },
        )

        await expect(randomIntFromInterval(0, 100)).rejects.toThrow(
            "random failed",
        )
    })
})
