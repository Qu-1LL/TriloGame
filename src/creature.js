
import { NodeQueue } from './queue-data.js'
import { toKey } from './cave.js'

const MOVEMENT_OFFSET_MIN_DISTANCE = 1
const MOVEMENT_OFFSET_MAX_DISTANCE = 15

function getRandomMovementOffset(minDistance = MOVEMENT_OFFSET_MIN_DISTANCE, maxDistance = MOVEMENT_OFFSET_MAX_DISTANCE) {
    const safeMin = Number.isFinite(minDistance) ? minDistance : MOVEMENT_OFFSET_MIN_DISTANCE
    const safeMax = Number.isFinite(maxDistance) ? maxDistance : MOVEMENT_OFFSET_MAX_DISTANCE
    const clampedMax = Math.max(safeMin, safeMax)
    const angleDegrees = Math.random() * 360
    const angleRadians = angleDegrees * (Math.PI / 180)
    const distance = safeMin + (Math.random() * (clampedMax - safeMin))

    return {
        x: Math.cos(angleRadians) * distance,
        y: Math.sin(angleRadians) * distance
    }
}

export class Creature {
    constructor(name,location,sprite,game) {
        this.name = name
        this.queue = new NodeQueue()
        this.pathPreview = []
        this.health = 20
        this.maxHealth = this.health
        this.damage = 5
        this.location = location
        this.sprite = sprite
        this.game = game
        this.cave = null
        
        this.assignment = "unassigned"

        sprite.on('mouseup', (interactionEvent) => {
            if (this.game.buildMode || this.game.dragging) {
                return
            }
            
            if (this.game.selected.object === this) {
                this.game.selected.setSelected(null)
                return
            }

            if (this.game.selected.object) {
                this.game.selected.setSelected(null)
            }
            this.game.selected.setSelected(this)
            this.game.movePath = false
        })
    }

    clearActionQueue() {
        this.queue.clear()
        this.pathPreview = []
    }

    restartBehavior({ clearQueue = true } = {}) {
        if (clearQueue) {
            this.clearActionQueue()
        }

        if (typeof this.getBehavior !== 'function') {
            return false
        }

        const behavior = this.getBehavior()
        if (typeof behavior !== 'function') {
            return false
        }

        return behavior.call(this)
    }

    getDamage() {
        return this.damage
    }

    getMaxHealth() {
        return this.maxHealth
    }

    restoreHealth() {
        this.health = this.getMaxHealth()
        return this.health
    }

    dealDamage(target) {
        if (!target || target === this || typeof target.takeDamage !== 'function') {
            return 0
        }

        return target.takeDamage(this.getDamage(), this)
    }

    takeDamage(amount, source = null) {
        if (!Number.isFinite(amount) || amount <= 0 || this.health <= 0) {
            return 0
        }

        const applied = Math.min(this.health, amount)
        this.health -= applied

        if (this.health <= 0) {
            this.health = 0
            this.removeFromGame(source)
        }

        return applied
    }

    cleanupBeforeRemoval() {
        return
    }

    removeFromGame(source = null) {
        if (this.cave && typeof this.cave.removeCreature === 'function') {
            return this.cave.removeCreature(this, source)
        }

        this.clearActionQueue()
        this.cleanupBeforeRemoval()

        if (this.sprite?.parent) {
            this.sprite.parent.removeChild(this.sprite)
        }

        if (typeof this.sprite?.destroy === 'function') {
            this.sprite.destroy()
        }

        this.location = { x: null, y: null }
        this.cave = null
        return true
    }

    enqueueAction(actionFn) {
        if (typeof actionFn !== 'function') {
            return false
        }
        this.queue.enqueue(actionFn)
        return true
    }

    getNavigationFallback() {
        if (this.assignment === "miner" && typeof this.minerStep1 === 'function') {
            return () => this.minerStep1()
        }
        if (this.assignment === "farmer" && typeof this.farmerStep1 === 'function') {
            return () => this.farmerStep1()
        }
        if (this.assignment === "builder" && typeof this.builderStep1 === 'function') {
            return () => this.builderStep1()
        }
        if (this.assignment === "fighter" && typeof this.fighterStep1 === 'function') {
            return () => this.fighterStep1()
        }
        if (this.assignment === "enemy" && typeof this.enemyStep1 === 'function') {
            return () => this.enemyStep1()
        }
        return null
    }

    runNavigationFallback(fallbackFn) {
        this.clearActionQueue()
        if (typeof fallbackFn === 'function') {
            this.enqueueAction(() => fallbackFn.call(this))
        }
        return false
    }

    buildNavigationPathToPoint(destination) {
        if (!destination || !this.cave) {
            return null
        }

        const field = this.cave.buildPointBfsField(destination)
        if (!(field instanceof Map)) {
            return null
        }

        return this.cave.buildPathFromField(field, this.location)
    }

    buildNavigationPathToBuilding(building) {
        if (!building || !this.cave) {
            return null
        }

        const field = this.cave.ensureBuildingBfsField(building)
        if (!(field instanceof Map)) {
            return null
        }

        return this.cave.buildPathFromField(field, this.location)
    }

    recoverNavigation(destination, fallbackFn) {
        this.clearActionQueue()

        if (!destination) {
            return this.runNavigationFallback(fallbackFn)
        }

        const reroute = this.buildNavigationPathToPoint(destination)
        if (reroute && reroute.length > 1) {
            const target = { x: destination.x, y: destination.y }
            this._enqueueResolvedPath(reroute, () => this.recoverNavigation(target, fallbackFn), false)
            return false
        }

        if (reroute && reroute.length === 1) {
            return true
        }

        return this.runNavigationFallback(fallbackFn)
    }

    recoverBuildingNavigation(building, fallbackFn) {
        this.clearActionQueue()

        if (!building) {
            return this.runNavigationFallback(fallbackFn)
        }

        const reroute = this.buildNavigationPathToBuilding(building)
        if (reroute && reroute.length > 1) {
            this._enqueueResolvedPath(reroute, () => this.recoverBuildingNavigation(building, fallbackFn), false)
            return false
        }

        if (reroute && reroute.length === 1) {
            return true
        }

        return this.runNavigationFallback(fallbackFn)
    }

    executeNavigationStep(next, onFailure) {
        const result = this.cave.moveCreature(this, next)
        if (result === false) {
            return typeof onFailure === 'function' ? onFailure() : false
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }
        return result
    }

    _enqueueResolvedPath(path, onFailure, clearExisting) {
        if (clearExisting) {
            this.clearActionQueue()
        }
        if (!path || path.length < 2) {
            return false
        }
        const steps = [...path]
        steps.shift()

        for (const step of steps) {
            const next = { x: step.x, y: step.y }
            this.pathPreview.push(next)

            this.enqueueAction(() => {
                return this.executeNavigationStep(next, onFailure)
            })
        }

        return true
    }

    navigateTo(destination, fallbackFn = this.getNavigationFallback(), clearExisting = true) {
        if (!destination) {
            return this.runNavigationFallback(fallbackFn)
        }

        const path = this.buildNavigationPathToPoint(destination)
        if (!path) {
            return this.runNavigationFallback(fallbackFn)
        }
        if (path.length < 2) {
            return true
        }

        const target = { x: destination.x, y: destination.y }
        return this._enqueueResolvedPath(path, () => this.recoverNavigation(target, fallbackFn), clearExisting)
    }

    navigateToBuilding(building, fallbackFn = this.getNavigationFallback(), clearExisting = true) {
        if (!building) {
            return this.runNavigationFallback(fallbackFn)
        }

        const path = this.buildNavigationPathToBuilding(building)
        if (!path) {
            return this.runNavigationFallback(fallbackFn)
        }
        if (path.length < 2) {
            return true
        }

        return this._enqueueResolvedPath(path, () => this.recoverBuildingNavigation(building, fallbackFn), clearExisting)
    }

    queueMovePath(path, fallbackFn = this.getNavigationFallback()) {
        if (!path || path.length === 0) {
            return false
        }

        const destination = path[path.length - 1]
        if (path.length < 2) {
            return true
        }

        const target = { x: destination.x, y: destination.y }
        return this._enqueueResolvedPath(path, () => this.recoverNavigation(target, fallbackFn), true)
    }

    appendMovePath(path, fallbackFn = this.getNavigationFallback()) {
        if (!path || path.length === 0) {
            return false
        }

        const destination = path[path.length - 1]
        if (path.length < 2) {
            return true
        }

        const target = { x: destination.x, y: destination.y }
        return this._enqueueResolvedPath(path, () => this.recoverNavigation(target, fallbackFn), false)
    }

    getQueuedPathPreview() {
        if (this.pathPreview.length === 0) {
            return []
        }
        return [{ x: this.location.x, y: this.location.y }, ...this.pathPreview]
    }

    move() {
        let nextAction = this.queue.dequeue()

        if (nextAction === null && typeof this.getBehavior === 'function') {
            const behavior = this.getBehavior()
            if (typeof behavior === 'function') {
                behavior.call(this)
                nextAction = this.queue.dequeue()
            }
        }

        if (nextAction === null) {
            return null
        }
        return nextAction()
    }

    getSpritePlacementForTile(tileSprite, { randomize = false } = {}) {
        if (!tileSprite || !Number.isFinite(tileSprite.x) || !Number.isFinite(tileSprite.y)) {
            return null
        }

        const scale = Number.isFinite(this.game?.currentScale) ? this.game.currentScale : 1
        const baseX = Number.isFinite(tileSprite.baseX) ? tileSprite.baseX : tileSprite.x
        const baseY = Number.isFinite(tileSprite.baseY) ? tileSprite.baseY : tileSprite.y
        const offset = randomize ? getRandomMovementOffset() : { x: 0, y: 0 }

        return {
            x: tileSprite.x + (offset.x * scale),
            y: tileSprite.y + (offset.y * scale),
            baseX: baseX + offset.x,
            baseY: baseY + offset.y
        }
    }

    placeSpriteOnTile(tileSprite, options = {}) {
        const placement = this.getSpritePlacementForTile(tileSprite, options)
        if (!placement || !this.sprite) {
            return false
        }

        this.sprite.x = placement.x
        this.sprite.y = placement.y
        this.sprite.baseX = placement.baseX
        this.sprite.baseY = placement.baseY
        return true
    }

    performMove(next) {
        return this.cave.moveCreature(this, next)
    }

    getActions() {
        let myTile = this.cave.getTile(toKey(this.location))
        let myNeighbors = [ ...myTile.getNeighbors()]

        var myActions = new Set()

        if (myTile.getBuilt()) {
            let myBuilding = myTile.getBuilt()
            if (myBuilding.hasStation) {
                myActions.add(myBuilding)
            }
        } 

        for (let n of myNeighbors) {
            if (n.getBuilt()) {
                if (!n.getBuilt().hasStation) {
                    myActions.add(n.getBuilt())
                }
            }
        }

        return myActions
    }

    getBuildable() {
        let myBuildings = [...this.game.unlockedBuildings]
        //if creature can build special buildings, add those here
        return myBuildings
    }
}
