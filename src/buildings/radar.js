import * as PIXI from 'pixi.js'
import { Building } from '../building.js'

export class Radar extends Building {

    constructor(game) {
        super('Radar', {x:4, y:4}, [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], game, false)
        this.sprite = PIXI.Sprite.from('Radar')

        this.radiusMax = 50
        this.currentRadius = 0
        this.growthChance = 0.1

        this.description = `Reveals tiles in an expanding radius. Has a 1 in 10 chance each tick to grow until radius ${this.getRadiusMax()}.`
    }

    getRadiusMax() {
        return this.radiusMax
    }

    getCurrentRadius() {
        return this.currentRadius
    }

    getCenterLocations() {
        if (!Number.isFinite(this.location.x) || !Number.isFinite(this.location.y)) {
            return []
        }

        const centerX = this.location.x + 1
        const centerY = this.location.y + 1
        return [
            { x: centerX, y: centerY },
            { x: centerX + 1, y: centerY },
            { x: centerX, y: centerY + 1 },
            { x: centerX + 1, y: centerY + 1 }
        ]
    }

    revealUnlockedArea(cave, previousRadius = -1) {
        if (!cave) {
            return 0
        }

        return cave.revealTilesBetweenRadii(this.getCenterLocations(), previousRadius, this.currentRadius)
    }

    onBuilt(cave) {
        cave.revealTiles(this.tileArray)
        this.revealUnlockedArea(cave, -1)
    }

    tick(cave) {
        if (!cave || this.currentRadius >= this.radiusMax) {
            return 0
        }

        if (Math.random() >= this.growthChance) {
            return 0
        }

        const previousRadius = this.currentRadius
        this.currentRadius++
        return this.revealUnlockedArea(cave, previousRadius)
    }
}
