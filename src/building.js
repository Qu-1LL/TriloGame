import * as PIXI from 'pixi.js'
import { Ore } from './ores.js'

function toKey(location) {
    return location.x + "," + location.y
}

function normalizeTileKey(tile) {
    if (tile === null || tile === undefined) {
        return null
    }
    if (typeof tile === 'string') {
        return tile
    }
    if (typeof tile === 'object') {
        if (typeof tile.key === 'string') {
            return tile.key
        }
        if (Number.isFinite(tile.x) && Number.isFinite(tile.y)) {
            return toKey(tile)
        }
    }
    return null
}

function keyToCoords(key) {
    const [x, y] = key.split(",").map(Number)
    return { x, y }
}

function squaredDistance(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return (dx * dx) + (dy * dy)
}

function isMineableType(tileType) {
    if (tileType === 'wall') {
        return true
    }
    for (const ore of Ore.getOres()) {
        if (ore.name === tileType) {
            return true
        }
    }
    return false
}

export class Factory {

    constructor(myClass,game) {
        this.myClass = myClass
        this.game = game

        let temp = new myClass()
        this.name = temp.name
        this.sprite = temp.sprite
        this.openMap = temp.openMap
        this.size = temp.size
        this.description = temp.description
        this.hasStation = temp.hasStation
    }

    build(...args) {
        return new this.myClass(this.game, ...args)
    }

}

export class Building {

    constructor (name,size,openMap,game,station) {
        this.name = name
        this.size = size
        this.openMap = openMap
        this.game = game
        this.tileArray = new Array()
        this.description = ''
        this.sprite = null
        this.hasStation = station
        this.location = {x: null, y: null}
    }

    rotateMap() {
        const rotated = [];

        for (let col = 0; col < this.size.x; col++) {
            rotated[col] = [];
            for (let row = this.size.y - 1; row >= 0; row--) {
                rotated[col].push(this.openMap[row][col]);
            }
        }

        this.openMap = rotated

        let temp = this.size.x
        this.size.x = this.size.y
        this.size.y = temp

        return rotated
    }

    setLocation(x,y) {
        this.location.x = x
        this.location.y = y
    } 

    getName() {
        return this.name
    }
    getSize() {
        return this.size
    }
    getMap() {
        return this.size
    }
    getGame() {
        return this.game
    }
    getDescription() {
        return this.description
    }

}

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

export class AlgaeFarm extends Building {

    constructor(game) {
        super('Algae Farm',{x:2,y:3},[[1,1],[1,1],[1,1]],game,false)
        this.sprite = PIXI.Sprite.from('Algae Farm')

        this.period = 30
        this.growth = 0
        this.harvestYield = 5
        this.assignments = new Set()

        this.description = `A passable algae farm. Worker trilobites harvest ${this.getHarvestYield()} algae when random < growth/period.`
    }

    getPeriod() {
        return this.period
    }

    getGrowth() {
        return this.growth
    }

    getHarvestYield() {
        return this.harvestYield
    }

    assign(creature) {
        if (!creature) {
            return false
        }
        this.assignments.add(creature)
        return true
    }

    removeAssignment(creature) {
        this.assignments.delete(creature)
    }

    getVolume() {
        return this.assignments.size
    }

    getPassableTileMap() {
        const tileMap = new Map()
        for (const tile of this.tileArray) {
            if (!tile || !tile.creatureFits()) {
                continue
            }
            tileMap.set(tile.key, tile)
        }
        return tileMap
    }

    isLocationOnFarm(location) {
        const locationKey = normalizeTileKey(location)
        if (!locationKey) {
            return false
        }

        const tile = this.getPassableTileMap().get(locationKey)
        return tile !== undefined
    }

    getApproachTile(startLocation) {
        const passableTiles = [...this.getPassableTileMap().values()]
        if (passableTiles.length === 0) {
            return null
        }

        let origin = keyToCoords(passableTiles[0].key)
        if (Number.isFinite(startLocation?.x) && Number.isFinite(startLocation?.y)) {
            origin = startLocation
        }

        let bestTile = passableTiles[0]
        let bestDist = squaredDistance(origin, keyToCoords(bestTile.key))

        for (const tile of passableTiles) {
            const dist = squaredDistance(origin, keyToCoords(tile.key))
            if (dist < bestDist) {
                bestDist = dist
                bestTile = tile
            }
        }

        return keyToCoords(bestTile.key)
    }

    findFarmPath(startKey, goalKey, passableTileMap) {
        if (!startKey || !goalKey || !passableTileMap.has(startKey) || !passableTileMap.has(goalKey)) {
            return null
        }

        if (startKey === goalKey) {
            return [startKey]
        }

        const queue = [startKey]
        let queueHead = 0
        const visited = new Set([startKey])
        const cameFrom = new Map()

        while (queueHead < queue.length) {
            const currentKey = queue[queueHead]
            queueHead++

            if (currentKey === goalKey) {
                const path = []
                let key = goalKey
                while (key !== undefined) {
                    path.push(key)
                    key = cameFrom.get(key)
                }
                path.reverse()
                return path
            }

            const currentTile = passableTileMap.get(currentKey)
            for (const neighbor of currentTile.getNeighbors()) {
                if (!passableTileMap.has(neighbor.key) || visited.has(neighbor.key)) {
                    continue
                }
                visited.add(neighbor.key)
                cameFrom.set(neighbor.key, currentKey)
                queue.push(neighbor.key)
            }
        }

        return null
    }

    findNextUnvisitedKey(currentKey, unvisitedKeys, passableTileMap) {
        let bestKey = null
        let bestLength = Infinity

        for (const candidateKey of unvisitedKeys) {
            const candidatePath = this.findFarmPath(currentKey, candidateKey, passableTileMap)
            if (!candidatePath) {
                continue
            }

            if (candidatePath.length < bestLength) {
                bestLength = candidatePath.length
                bestKey = candidateKey
            }
        }

        return bestKey
    }

    getPath(currentPositionOnFarm) {
        const passableTileMap = this.getPassableTileMap()
        if (passableTileMap.size === 0) {
            return []
        }

        let originKey = normalizeTileKey(currentPositionOnFarm)
        if (!originKey || !passableTileMap.has(originKey)) {
            const approachTile = this.getApproachTile(currentPositionOnFarm)
            originKey = approachTile ? toKey(approachTile) : [...passableTileMap.keys()][0]
        }

        const route = [originKey]
        const unvisited = new Set(passableTileMap.keys())
        unvisited.delete(originKey)
        let currentKey = originKey

        while (unvisited.size > 0) {
            const nextKey = this.findNextUnvisitedKey(currentKey, unvisited, passableTileMap)
            if (!nextKey) {
                break
            }

            const segment = this.findFarmPath(currentKey, nextKey, passableTileMap)
            if (!segment || segment.length < 2) {
                unvisited.delete(nextKey)
                continue
            }

            for (let i = 1; i < segment.length; i++) {
                route.push(segment[i])
                unvisited.delete(segment[i])
            }

            currentKey = route[route.length - 1]
        }

        if (currentKey !== originKey) {
            const returnPath = this.findFarmPath(currentKey, originKey, passableTileMap)
            if (returnPath && returnPath.length > 1) {
                for (let i = 1; i < returnPath.length; i++) {
                    route.push(returnPath[i])
                }
            }
        }

        return route.map((key) => keyToCoords(key))
    }

    tryHarvest(creature) {
        if (!creature || typeof creature.addToInventory !== 'function') {
            return false
        }

        this.growth++
        const harvestChance = this.growth / this.period
        if (Math.random() >= harvestChance) {
            return false
        }

        const harvested = creature.addToInventory('Algae', this.harvestYield)
        if (harvested !== this.harvestYield) {
            return false
        }

        this.growth = 0
        return true
    }

}

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

export class Storage extends Building {

    constructor (game) {
        super("Storage",{x:2,y:2},[[0,0],[0,0]],game,false)
        this.sprite = PIXI.Sprite.from('Storage')

        this.capacity = 20

        this.description = `A container that can hold up to ${this.getCapacity()} items.`
    }

    getCapacity() {
        return this.capacity
    }
}

export class Smith extends Building {

    constructor (game) {
        super("Smith",{x:2,y:2},[[0,0],[0,1]],game,true)
        this.sprite = PIXI.Sprite.from('Smith')

        this.description = `A building that allows you to craft new items for your species.`
    }

    //recipes stored here 
    //need to create item object
}
