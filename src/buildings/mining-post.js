import * as PIXI from 'pixi.js'
import { Building, keyToCoords, normalizeTileKey, squaredDistance, toKey, isMineableType } from '../building.js'
import { Ore } from '../ores.js'

export class MiningPost extends Building {
    constructor(game){
        super('Mining Post', {x:3, y:3}, [[1,1,1],[1,0,1],[1,1,1]],game,true)
        this.sprite = PIXI.Sprite.from('Mining Post')
        this.description = `Units assigned to this post will mine ore and stone in a ${this.getRadius()}-block radius and store it here. Has a capacity of ${this.getCapacity()}.`

        this.capacity = 1000
        this.radius = 10
        this.inventory = {}
        for (const ore of Ore.getOres()) {
            this.inventory[ore.name] = 0
        }
        this.assignments = new Map()
        this.mineableQueues = {}
        this.mineableQueueHeads = {}
        this.mineableTypes = []
        this.mineableQueuesReady = false
        this.mineableQueuesDirty = true
    }
    
    getCapacity() {
        return this.capacity
    }

    getRadius(){
        return this.radius
    }

    getInventory() {
        return this.inventory
    }

    getInventoryTotal() {
        let total = 0
        for (const amount of Object.values(this.inventory)) {
            total += amount
        }
        return total
    }

    getInventorySpace() {
        return Math.max(0, this.capacity - this.getInventoryTotal())
    }

    deposit(resourceType, amount) {
        if (typeof resourceType !== 'string' || !Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        if (this.inventory[resourceType] === undefined) {
            this.inventory[resourceType] = 0
        }

        const accepted = Math.min(this.getInventorySpace(), amount)
        this.inventory[resourceType] += accepted

        return accepted
    }

    withdraw(resourceType, amount) {
        if (typeof resourceType !== 'string' || !Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        if (this.inventory[resourceType] === undefined) {
            this.inventory[resourceType] = 0
        }

        const taken = Math.min(this.inventory[resourceType], amount)
        this.inventory[resourceType] -= taken

        return taken
    }

    getAssignments () {
        return this.assignments
    }

    assign(creature, tile) {
        const tileKey = normalizeTileKey(tile)

        if (tileKey !== null && this.isTileAssignedToOther(creature, tileKey)) {
            return false
        }

        this.assignments.set(creature, tileKey)
        return true
    }

    removeAssignment(creature) {
        this.assignments.delete(creature)
    }

    getAssignment(creature) {
        return this.assignments.get(creature)
    }

    isTileAssignedToOther(creature, tileKey) {
        for (const [otherCreature, otherTileKey] of this.assignments.entries()) {
            if (otherCreature !== creature && otherTileKey === tileKey) {
                return true
            }
        }
        return false
    }

    getAssignedTileKeys(excludeCreature = null) {
        const assigned = new Set()
        for (const [creature, tileKey] of this.assignments.entries()) {
            if (creature === excludeCreature || tileKey === null || tileKey === undefined) {
                continue
            }
            assigned.add(tileKey)
        }
        return assigned
    }

    getVolume() {
        return this.assignments.size
    }

    getCenter() {
        return {
            x: this.location.x + Math.floor(this.size.x / 2),
            y: this.location.y + Math.floor(this.size.y / 2)
        }
    }

    onBuilt(cave) {
        this.rebuildMineableQueues(cave)
    }

    invalidateMineableQueues() {
        this.mineableQueuesDirty = true
    }

    invalidateMineableQueuesForKeys(tileKeys) {
        if (!Array.isArray(tileKeys) || tileKeys.length === 0) {
            return
        }

        for (const tileKey of tileKeys) {
            const tileCoords = keyToCoords(tileKey)
            if (this.isLocationInArea(tileCoords)) {
                this.invalidateMineableQueues()
                return
            }
        }
    }

    ensureMineableQueues(cave) {
        if (!this.mineableQueuesReady || this.mineableQueuesDirty) {
            this.rebuildMineableQueues(cave)
        }
    }

    rebuildMineableQueues(cave) {
        const center = this.getCenter()
        const radiusSq = this.radius * this.radius
        const grouped = {}

        for (const tile of cave.getTiles()) {
            const tileCoords = keyToCoords(tile.key)
            const dist = squaredDistance(tileCoords, center)
            if (dist > radiusSq) {
                continue
            }

            const tileType = tile.getBase()
            if (!isMineableType(tileType)) {
                continue
            }

            if (!grouped[tileType]) {
                grouped[tileType] = []
            }
            grouped[tileType].push({ key: tile.key, dist })
        }

        this.mineableQueues = {}
        this.mineableQueueHeads = {}
        this.mineableTypes = Object.keys(grouped)

        for (const type of this.mineableTypes) {
            grouped[type].sort((a, b) => {
                if (a.dist !== b.dist) {
                    return a.dist - b.dist
                }
                if (a.key < b.key) {
                    return -1
                }
                if (a.key > b.key) {
                    return 1
                }
                return 0
            })

            this.mineableQueues[type] = grouped[type].map((entry) => entry.key)
            this.mineableQueueHeads[type] = 0
        }

        this.mineableQueuesReady = true
        this.mineableQueuesDirty = false
    }

    getTypeQueueLength(type) {
        const queue = this.mineableQueues[type]
        if (!queue) {
            return 0
        }
        const head = this.mineableQueueHeads[type] ?? 0
        return Math.max(0, queue.length - head)
    }

    hasQueuedMineableTiles(cave) {
        this.ensureMineableQueues(cave)
        for (const type of this.mineableTypes) {
            if (this.getTypeQueueLength(type) > 0) {
                return true
            }
        }
        return false
    }

    popTypeQueueKey(type) {
        const queue = this.mineableQueues[type]
        if (!queue) {
            return null
        }

        const head = this.mineableQueueHeads[type] ?? 0
        if (head >= queue.length) {
            return null
        }

        const tileKey = queue[head]
        this.mineableQueueHeads[type] = head + 1
        this.compactTypeQueue(type)
        return tileKey
    }

    pushTypeQueueKey(type, tileKey) {
        if (!this.mineableQueues[type]) {
            this.mineableQueues[type] = []
            this.mineableQueueHeads[type] = 0
            this.mineableTypes.push(type)
        }
        this.mineableQueues[type].push(tileKey)
    }

    compactTypeQueue(type) {
        const queue = this.mineableQueues[type]
        const head = this.mineableQueueHeads[type] ?? 0
        if (!queue || head < 64 || (head * 2) < queue.length) {
            return
        }

        this.mineableQueues[type] = queue.slice(head)
        this.mineableQueueHeads[type] = 0
    }

    pullQueuedMineableTile(cave, type, reservedTiles) {
        const center = this.getCenter()
        const radiusSq = this.radius * this.radius
        const queueLength = this.getTypeQueueLength(type)

        for (let i = 0; i < queueLength; i++) {
            const tileKey = this.popTypeQueueKey(type)
            if (!tileKey) {
                return null
            }

            const tile = cave.getTile(tileKey)
            if (!tile) {
                continue
            }

            if (tile.getBase() !== type) {
                continue
            }

            const tileCoords = keyToCoords(tileKey)
            if (squaredDistance(tileCoords, center) > radiusSq) {
                continue
            }

            const navTarget = this.getNavigationTarget(cave, tile)
            if (!navTarget) {
                continue
            }

            if (reservedTiles.has(tileKey)) {
                this.pushTypeQueueKey(type, tileKey)
                continue
            }

            return tile
        }

        return null
    }

    isLocationInArea(location) {
        if (this.location.x === null || this.location.y === null) {
            return false
        }
        const center = this.getCenter()
        return squaredDistance(location, center) <= (this.radius * this.radius)
    }

    isLocationOnPost(location) {
        const key = toKey(location)
        for (const tile of this.tileArray) {
            if (tile.key === key) {
                return true
            }
        }
        return false
    }

    getMineableTypeSet(cave) {
        const mineableTypes = new Set()
        const center = this.getCenter()

        for (const tile of cave.getTiles()) {
            const tileCoords = keyToCoords(tile.key)
            if (squaredDistance(tileCoords, center) > (this.radius * this.radius)) {
                continue
            }

            const tileType = tile.getBase()
            if (isMineableType(tileType)) {
                mineableTypes.add(tileType)
            }
        }

        return mineableTypes
    }

    getNavigationTarget(cave, tile) {
        const tileCoords = keyToCoords(tile.key)
        const center = this.getCenter()

        if (tile.getBase() !== 'wall') {
            if (tile.creatureFits()) {
                return tileCoords
            }
            return null
        }

        let bestTarget = null
        let bestDist = Infinity

        for (const neighbor of tile.getNeighbors()) {
            if (!neighbor.creatureFits()) {
                continue
            }

            const neighborCoords = keyToCoords(neighbor.key)
            const dist = squaredDistance(neighborCoords, center)
            if (dist < bestDist) {
                bestDist = dist
                bestTarget = neighborCoords
            }
        }

        return bestTarget
    }

    getApproachTile(cave, startLocation) {
        let bestTile = null
        let bestDist = Infinity

        for (const tile of this.tileArray) {
            if (!tile.creatureFits()) {
                continue
            }

            const tileCoords = keyToCoords(tile.key)
            const dist = squaredDistance(tileCoords, startLocation)
            if (dist < bestDist) {
                bestDist = dist
                bestTile = tileCoords
            }
        }

        return bestTile
    }

    grabMineableTile(cave, creature = null) {
        this.ensureMineableQueues(cave)

        const mineableTypes = this.mineableTypes.filter((type) => this.getTypeQueueLength(type) > 0)
        if (mineableTypes.length === 0) {
            return null
        }

        // Preserve randomized type choice while using precomputed per-type queues.
        for (let i = mineableTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[mineableTypes[i], mineableTypes[j]] = [mineableTypes[j], mineableTypes[i]]
        }

        const reservedTiles = this.getAssignedTileKeys(creature)

        for (const type of mineableTypes) {
            const queuedTile = this.pullQueuedMineableTile(cave, type, reservedTiles)
            if (!queuedTile) {
                continue
            }

            if (creature && !this.assign(creature, queuedTile.key)) {
                this.invalidateMineableQueues()
                continue
            }

            return queuedTile
        }

        return null
    }
}
