
import { NodeQueue } from './queue-data.js'
import { toKey } from './cave.js'

export class Creature {
    constructor(name,location,sprite,game) {
        this.name = name
        this.queue = new NodeQueue()
        this.pathPreview = []
        this.health = 20
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

    getDamage() {
        return this.damage
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
        return null
    }

    runNavigationFallback(fallbackFn) {
        this.clearActionQueue()
        if (typeof fallbackFn === 'function') {
            this.enqueueAction(() => fallbackFn.call(this))
        }
        return false
    }

    recoverNavigation(destination, fallbackFn) {
        this.clearActionQueue()

        if (!destination) {
            return this.runNavigationFallback(fallbackFn)
        }

        const reroute = this.cave.bfsPath(toKey(this.location), toKey(destination))
        if (reroute && reroute.length > 1) {
            this._enqueueNavigationPath(reroute, destination, fallbackFn, false)
            return false
        }

        if (reroute && reroute.length === 1) {
            return true
        }

        return this.runNavigationFallback(fallbackFn)
    }

    executeNavigationStep(next, destination, fallbackFn) {
        const result = this.cave.moveCreature(this, next)
        if (result === false) {
            return this.recoverNavigation(destination, fallbackFn)
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }
        return result
    }

    _enqueueNavigationPath(path, destination, fallbackFn, clearExisting) {
        if (clearExisting) {
            this.clearActionQueue()
        }
        if (!path || path.length < 2) {
            return false
        }

        const target = {
            x: destination.x,
            y: destination.y
        }
        const steps = [...path]
        steps.shift()

        for (const step of steps) {
            const next = { x: step.x, y: step.y }
            this.pathPreview.push(next)

            this.enqueueAction(() => {
                return this.executeNavigationStep(next, target, fallbackFn)
            })
        }

        return true
    }

    navigateTo(destination, fallbackFn = this.getNavigationFallback(), clearExisting = true) {
        if (!destination) {
            return this.runNavigationFallback(fallbackFn)
        }

        const path = this.cave.bfsPath(toKey(this.location), toKey(destination))
        if (!path) {
            return this.runNavigationFallback(fallbackFn)
        }
        if (path.length < 2) {
            return true
        }

        return this._enqueueNavigationPath(path, destination, fallbackFn, clearExisting)
    }

    queueMovePath(path, fallbackFn = this.getNavigationFallback()) {
        if (!path || path.length === 0) {
            return false
        }

        const destination = path[path.length - 1]
        if (path.length < 2) {
            return true
        }

        return this._enqueueNavigationPath(path, destination, fallbackFn, true)
    }

    appendMovePath(path, fallbackFn = this.getNavigationFallback()) {
        if (!path || path.length === 0) {
            return false
        }

        const destination = path[path.length - 1]
        if (path.length < 2) {
            return true
        }

        return this._enqueueNavigationPath(path, destination, fallbackFn, false)
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
