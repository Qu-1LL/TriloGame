import * as PIXI from 'pixi.js'
import { Creature } from '../creature.js'
import { toCoords, toKey } from '../cave.js'

function squaredDistance(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return (dx * dx) + (dy * dy)
}

function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function isEnemyCreature(creature) {
    return creature?.assignment === 'enemy' || creature?.constructor?.name === 'Enemy'
}

export class Enemy extends Creature {

    constructor(name, location, game, sprite = new PIXI.Sprite("Enemy")) {
        super(name, location, sprite, game)
        this.assignment = 'enemy'
        this.enemyTargetTileKey = null
        this.enemyPathMode = null
    }

    getBehavior() {
        return this.enemyBehavior
    }

    cleanupBeforeRemoval() {
        this.enemyTargetTileKey = null
        this.enemyPathMode = null
    }

    enemyBehavior = () => {
        return this.enqueueAction(() => this.enemyStep1())
    }

    ensureEnemyState() {
        if (isEnemyCreature(this)) {
            return true
        }

        this.enemyTargetTileKey = null
        this.enemyPathMode = null
        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.enemyBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    clearEnemyTarget() {
        this.enemyTargetTileKey = null
    }

    getHostileCreatures() {
        if (!this.cave) {
            return []
        }

        const hostiles = []
        for (const creature of this.cave.creatures) {
            if (!creature || creature === this || isEnemyCreature(creature)) {
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

        for (const hostile of this.getHostileCreatures()) {
            if (toKey(hostile.location) === tileKey) {
                return hostile
            }
        }

        return null
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

        for (const neighbor of currentTile.getNeighbors()) {
            if (this.getHostileAtTileKey(neighbor.key)) {
                return neighbor.key
            }
        }

        return null
    }

    findNearestHostilePath() {
        if (!this.cave) {
            return null
        }

        let bestTarget = null
        let bestLength = Infinity
        let bestDistance = Infinity

        for (const hostile of this.getHostileCreatures()) {
            const hostileTileKey = toKey(hostile.location)
            if (this.isAdjacentToTileKey(hostileTileKey)) {
                return {
                    creature: hostile,
                    tileKey: hostileTileKey,
                    path: [{ x: this.location.x, y: this.location.y }]
                }
            }

            const hostileTile = this.cave.getTile(hostileTileKey)
            if (!hostileTile) {
                continue
            }

            for (const neighbor of hostileTile.getNeighbors()) {
                if (!neighbor.creatureFits()) {
                    continue
                }

                const path = this.cave.bfsPath(toKey(this.location), neighbor.key)
                if (!path) {
                    continue
                }

                const pathLength = path.length
                const approachCoords = toCoords(neighbor.key)
                const distance = squaredDistance(this.location, approachCoords)

                if (pathLength < bestLength || (pathLength === bestLength && distance < bestDistance)) {
                    bestTarget = {
                        creature: hostile,
                        tileKey: hostileTileKey,
                        path
                    }
                    bestLength = pathLength
                    bestDistance = distance
                }
            }
        }

        return bestTarget
    }

    queueEnemyPath(path, mode = null, clearExisting = true) {
        if (!path || path.length === 0) {
            return false
        }

        if (clearExisting) {
            this.clearActionQueue()
        }

        if (path.length < 2) {
            this.enemyPathMode = null
            return true
        }

        this.enemyPathMode = mode

        const steps = [...path]
        steps.shift()

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            const next = { x: step.x, y: step.y }
            const isLastStep = i === (steps.length - 1)
            this.pathPreview.push(next)
            this.enqueueAction(() => this.enemyStepMove(next, isLastStep))
        }

        return true
    }

    enemyStep1 = () => {
        if (!this.ensureEnemyState()) {
            return false
        }

        this.enemyPathMode = null

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

        const hostile = this.getHostileAtTileKey(this.enemyTargetTileKey)
        if (!hostile) {
            this.clearEnemyTarget()
            return this.enemyStep3()
        }

        if (!this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
            return this.enemyStep3()
        }

        const dealt = this.dealDamage(hostile)
        if (!this.getHostileAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
        }

        return dealt > 0
    }

    enemyStep3 = () => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (this.enemyTargetTileKey && !this.getHostileAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
        }

        const target = this.findNearestHostilePath()
        if (!target) {
            this.clearEnemyTarget()
            return false
        }

        this.enemyTargetTileKey = target.tileKey
        if (!target.path || target.path.length < 2) {
            if (this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
                return this.enemyStep2()
            }
            return false
        }

        return this.queueEnemyPath(target.path, 'enemy')
    }

    enemyStepMove = (nextLocation, isLastStep = false) => {
        if (!this.ensureEnemyState()) {
            return false
        }

        if (this.enemyTargetTileKey && !this.getHostileAtTileKey(this.enemyTargetTileKey)) {
            this.clearEnemyTarget()
            this.enemyPathMode = null
            this.clearActionQueue()
            return this.enemyStep3()
        }

        const adjacentHostileTileKey = this.getAdjacentHostileTileKey()
        if (adjacentHostileTileKey) {
            this.enemyTargetTileKey = adjacentHostileTileKey
            this.enemyPathMode = null
            this.clearActionQueue()
            return this.enemyStep2()
        }

        const moved = this.performMove(nextLocation)
        if (moved === false) {
            this.enemyPathMode = null
            this.clearActionQueue()
            return this.enemyStep1()
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }

        if (this.enemyTargetTileKey && this.isAdjacentToTileKey(this.enemyTargetTileKey)) {
            this.enemyPathMode = null
            this.clearActionQueue()
            return this.enemyStep2()
        }

        const nextAdjacentHostileTileKey = this.getAdjacentHostileTileKey()
        if (nextAdjacentHostileTileKey) {
            this.enemyTargetTileKey = nextAdjacentHostileTileKey
            this.enemyPathMode = null
            this.clearActionQueue()
            return this.enemyStep2()
        }

        if (isLastStep) {
            this.enemyPathMode = null
            return this.enemyStep1()
        }

        return moved
    }

}
