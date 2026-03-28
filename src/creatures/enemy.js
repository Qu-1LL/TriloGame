import * as PIXI from 'pixi.js'
import { Creature } from '../creature.js'
import { toCoords, toKey } from '../cave.js'

function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function isEnemyCreature(creature) {
    return creature?.assignment === 'enemy' || creature?.constructor?.name === 'Enemy'
}

function isTrackedTrilobite(creature) {
    return creature?.constructor?.name === 'Trilobite'
}

export class Enemy extends Creature {

    constructor(name, location, game, sprite = new PIXI.Sprite("Enemy")) {
        super(name, location, sprite, game)
        this.assignment = 'enemy'
        this.enemyTargetTileKey = null
    }

    getBehavior() {
        return this.enemyBehavior
    }

    cleanupBeforeRemoval() {
        this.enemyTargetTileKey = null
    }

    enemyBehavior = () => {
        return this.enqueueAction(() => this.enemyStep1())
    }

    ensureEnemyState() {
        if (isEnemyCreature(this)) {
            return true
        }

        this.enemyTargetTileKey = null
        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.enemyBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    clearEnemyTarget() {
        this.enemyTargetTileKey = null
    }

    getHostileTrilobites() {
        if (!this.cave) {
            return []
        }

        const hostiles = []
        for (const creature of this.cave.trilobites) {
            if (!creature || creature === this || !isTrackedTrilobite(creature)) {
                continue
            }

            hostiles.push(creature)
        }

        return hostiles
    }

    getHostileAtTileKey(tileKey) {
        if (!tileKey) {
            return null
        }

        for (const hostile of this.getHostileTrilobites()) {
            if (toKey(hostile.location) === tileKey) {
                return hostile
            }
        }

        return null
    }

    getHostileBuildingAtTileKey(tileKey) {
        if (!this.cave || !tileKey) {
            return null
        }

        const tile = this.cave.getTile(tileKey)
        if (!tile) {
            return null
        }

        const building = tile.getBuilt()
        if (!building || building.cave !== this.cave || building.health <= 0) {
            return null
        }

        return building
    }

    getHostileTargetAtTileKey(tileKey) {
        return this.getHostileAtTileKey(tileKey) ?? this.getHostileBuildingAtTileKey(tileKey)
    }

    isAdjacentToTileKey(tileKey, location = this.location) {
        const tileCoords = toCoords(tileKey)
        if (!Number.isFinite(tileCoords?.x) || !Number.isFinite(tileCoords?.y)) {
            return false
        }

        return manhattanDistance(location, tileCoords) === 1
    }

    getAdjacentHostileTileKey(location = this.location) {
        if (!this.cave) {
            return null
        }

        const currentTile = this.cave.getTile(toKey(location))
        if (!currentTile) {
            return null
        }

        let adjacentBuildingTileKey = null
        for (const neighbor of currentTile.getNeighbors()) {
            if (this.getHostileAtTileKey(neighbor.key)) {
                return neighbor.key
            }

            if (!adjacentBuildingTileKey && this.getHostileBuildingAtTileKey(neighbor.key)) {
                adjacentBuildingTileKey = neighbor.key
            }
        }

        return adjacentBuildingTileKey
    }

    enemyStep1 = () => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (this.enemyTargetTileKey && this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
            return this.enemyStep2()
        }

        const adjacentHostileTileKey = this.getAdjacentHostileTileKey()
        if (adjacentHostileTileKey) {
            this.enemyTargetTileKey = adjacentHostileTileKey
            return this.enemyStep2()
        }

        return this.enemyStep3()
    }

    enemyStep2 = () => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (!this.enemyTargetTileKey) {
            return this.enemyStep3()
        }

        const hostile = this.getHostileTargetAtTileKey(this.enemyTargetTileKey)
        if (!hostile) {
            this.clearEnemyTarget()
            return this.enemyStep3()
        }

        if (!this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
            return this.enemyStep3()
        }

        const dealt = this.dealDamage(hostile)
        if (!this.getHostileTargetAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
        }

        return dealt > 0
    }

    enemyStep3 = () => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (this.enemyTargetTileKey && !this.getHostileTargetAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
        }

        const nextLocation = this.cave?.getBfsFieldNextStep('colony', this.location)
        if (!nextLocation) {
            this.clearEnemyTarget()
            return false
        }

        this.clearActionQueue()
        this.pathPreview.push({ x: nextLocation.x, y: nextLocation.y })
        return this.enemyStepMove(nextLocation)
    }

    enemyStepMove = (nextLocation) => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (this.enemyTargetTileKey && !this.getHostileTargetAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
            this.clearActionQueue()
            return this.enemyStep3()
        }

        const adjacentHostileTileKey = this.getAdjacentHostileTileKey()
        if (adjacentHostileTileKey) {
            this.enemyTargetTileKey = adjacentHostileTileKey
            this.clearActionQueue()
            return this.enemyStep2()
        }

        const moved = this.performMove(nextLocation)
        if (moved === false) {
            this.clearActionQueue()
            return this.enemyStep3()
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }

        if (this.enemyTargetTileKey && this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
            this.clearActionQueue()
            return this.enemyStep2()
        }

        const nextAdjacentHostileTileKey = this.getAdjacentHostileTileKey()
        if (nextAdjacentHostileTileKey) {
            this.enemyTargetTileKey = nextAdjacentHostileTileKey
            this.clearActionQueue()
            return this.enemyStep2()
        }

        return moved
    }

}
