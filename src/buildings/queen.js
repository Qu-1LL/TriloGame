import * as PIXI from 'pixi.js'
import { Building, keyToCoords, toKey } from '../building.js'

export class Queen extends Building {

    constructor(game) {
        super('Queen',{x:3, y:3},[[1,1,1],[1,0,1],[1,1,1]],game,true)
        this.sprite = PIXI.Sprite.from('Queen')

        this.algaeQuota = 20
        this.algaeCount = 0
        this.broodlingCount = 1

        this.description = `The one and only Queen of your colony! Protect her at all costs!`
    }

    getAlgaeQuota() {
        return this.algaeQuota
    }

    getAlgaeCount() {
        return this.algaeCount
    }

    getFeedTiles() {
        const feedTiles = []
        for (const tile of this.tileArray) {
            if (tile && tile.creatureFits()) {
                feedTiles.push(tile)
            }
        }
        return feedTiles
    }

    canBeFedBy(creature) {
        if (!creature || !creature.location) {
            return false
        }

        const creatureKey = toKey(creature.location)
        for (const tile of this.getFeedTiles()) {
            if (tile.key === creatureKey) {
                return true
            }
        }

        return false
    }

    getBirthTile() {
        const feedTiles = this.getFeedTiles()
        if (feedTiles.length === 0) {
            return null
        }

        const randomIndex = Math.floor(Math.random() * feedTiles.length)
        return feedTiles[randomIndex]
    }

    birth(cave, feeder = null) {
        const activeCave = cave ?? feeder?.cave
        if (!activeCave || !feeder || typeof feeder.constructor !== 'function') {
            return false
        }

        const birthTile = this.getBirthTile()
        if (!birthTile || !birthTile.creatureFits()) {
            return false
        }

        const spawnLocation = keyToCoords(birthTile.key)
        const spawnName = `Broodling ${this.broodlingCount}`
        this.broodlingCount++

        const brood = new feeder.constructor(spawnName, spawnLocation, feeder.game)
        return activeCave.spawn(brood, birthTile)
    }

    feedAlgae(amount, creature = null, cave = null) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return { accepted: 0, spawnCount: 0 }
        }

        if (creature && !this.canBeFedBy(creature)) {
            return { accepted: 0, spawnCount: 0 }
        }

        this.algaeCount += amount

        let spawnCount = 0
        while (this.algaeCount >= this.algaeQuota) {
            this.algaeCount -= this.algaeQuota
            this.algaeQuota += 5
            if (this.birth(cave, creature)) {
                spawnCount++
            }
        }

        return {
            accepted: amount,
            spawnCount
        }
    }
}
