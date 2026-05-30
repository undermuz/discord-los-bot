import { randomInt } from "node:crypto"

export function randomIntFromInterval(
    min: number,
    max: number,
): Promise<number> {
    return new Promise((resolve, reject) => {
        randomInt(min, max, (err, n) => {
            if (err) {
                reject(err)
                return
            }

            resolve(n)
        })
    })
}
