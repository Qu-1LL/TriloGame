import { Ore } from './ores.js'

export class Stats {

    constructor(game) {
        this.game = game
        this.values = this.createDefaultValues()
        this.unsubscribe = []

        this.listen('tileMined')
        this.listen('wallMined')
        this.listen('trilobiteSpawned')

        for (const ore of Ore.getOres()) {
            this.listen(`${ore.name}Mined`)
        }
    }

    createDefaultValues() {
        const values = {
            tileMined: 0,
            wallMined: 0,
            trilobiteSpawned: 0
        }

        for (const ore of Ore.getOres()) {
            values[`${ore.name}Mined`] = 0
        }

        return values
    }

    listen(eventName) {
        const unsubscribe = this.game.on(eventName, () => {
            this.increment(eventName)
        })
        this.unsubscribe.push(unsubscribe)
    }

    ensure(eventName) {
        if (typeof eventName !== 'string' || eventName.length === 0) {
            return
        }

        if (!Object.hasOwn(this.values, eventName)) {
            this.values[eventName] = 0
        }
    }

    increment(eventName, amount = 1) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return this.get(eventName)
        }

        this.ensure(eventName)
        this.values[eventName] += amount
        return this.values[eventName]
    }

    get(eventName) {
        if (typeof eventName !== 'string' || eventName.length === 0) {
            return 0
        }
        return this.values[eventName] ?? 0
    }

    getAll() {
        return { ...this.values }
    }

    destroy() {
        for (const unsubscribe of this.unsubscribe) {
            if (typeof unsubscribe === 'function') {
                unsubscribe()
            }
        }
        this.unsubscribe = []
    }

}
