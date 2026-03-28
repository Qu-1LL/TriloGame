function toKey(location) {
    if (typeof location === 'string') {
        return location
    }

    if (Number.isFinite(location?.x) && Number.isFinite(location?.y)) {
        return location.x + "," + location.y
    }

    return null
}

function toCoords(coords) {
    if (coords && typeof coords === 'object' && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
        return { x: coords.x, y: coords.y }
    }

    try {
        const [x, y] = String(coords).split(",").map(Number)
        return { x, y }
    } catch (error) {
        return coords
    }
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

export class BfsField {

    constructor({
        name = '',
        type = 'shared',
        cave = null,
        ownerBuilding = null
    } = {}) {
        this.name = typeof name === 'string' ? name : ''
        this.type = typeof type === 'string' ? type : 'shared'
        this.cave = cave
        this.ownerBuilding = ownerBuilding
        this.field = new Map()
        this.updated = false
        this.updatedTiles = new Set()
        this.updatedBuildings = new Set()
        this.updatedCreatures = new Set()
        this.trackedBuildings = new Set()
        this.trackedCreatures = new Set()
    }

    getName() {
        return this.name
    }

    getType() {
        return this.type
    }

    setCave(cave) {
        this.cave = cave
        return this.cave
    }

    getCave() {
        return this.cave
    }

    setOwnerBuilding(building) {
        this.ownerBuilding = building
        return this.ownerBuilding
    }

    getOwnerBuilding() {
        return this.ownerBuilding
    }

    setField(field) {
        this.field = field instanceof Map ? field : new Map()
        return this.field
    }

    commitField(field) {
        this.setField(field)
        this.clearUpdates()
        return this.field
    }

    getField({ refresh = true } = {}) {
        return refresh ? this.refresh() : this.field
    }

    isUpdated() {
        return this.updated === true
    }

    getUpdatedTileKeys() {
        return [...this.updatedTiles]
    }

    getUpdatedBuildings() {
        return [...this.updatedBuildings]
    }

    getUpdatedCreatures() {
        return [...this.updatedCreatures]
    }

    getTrackedBuildings() {
        return [...this.trackedBuildings]
    }

    getTrackedCreatures() {
        return [...this.trackedCreatures]
    }

    setTrackedTargets({ buildings = [], creatures = [] } = {}) {
        this.trackedBuildings.clear()
        this.trackedCreatures.clear()

        for (const building of buildings) {
            if (building) {
                this.trackedBuildings.add(building)
            }
        }

        for (const creature of creatures) {
            if (creature) {
                this.trackedCreatures.add(creature)
            }
        }

        return {
            buildings: this.getTrackedBuildings(),
            creatures: this.getTrackedCreatures()
        }
    }

    clearUpdates() {
        this.updated = true
        this.updatedTiles.clear()
        this.updatedBuildings.clear()
        this.updatedCreatures.clear()
        return this.updated
    }

    markTilesDirty(tileKeys = []) {
        this.updated = false

        if (!Array.isArray(tileKeys)) {
            return this.updated
        }

        for (const tileKey of tileKeys) {
            const normalizedTileKey = normalizeTileKey(tileKey)
            if (normalizedTileKey !== null) {
                this.updatedTiles.add(normalizedTileKey)
            }
        }

        return this.updated
    }

    markBuildingsDirty(buildings = []) {
        this.updated = false

        if (!Array.isArray(buildings)) {
            return this.updated
        }

        for (const building of buildings) {
            if (building) {
                this.updatedBuildings.add(building)
            }
        }

        return this.updated
    }

    markCreaturesDirty(creatures = []) {
        this.updated = false

        if (!Array.isArray(creatures)) {
            return this.updated
        }

        for (const creature of creatures) {
            if (creature) {
                this.updatedCreatures.add(creature)
            }
        }

        return this.updated
    }

    markDirty({ tileKeys = [], buildings = [], creatures = [] } = {}) {
        this.updated = false
        this.markTilesDirty(tileKeys)
        this.markBuildingsDirty(buildings)
        this.markCreaturesDirty(creatures)
        return this.updated
    }

    hasActiveBuildingTarget() {
        if (this.type !== 'building') {
            return false
        }

        const building = this.getOwnerBuilding()
        return Boolean(
            this.cave &&
            building &&
            Array.isArray(building.tileArray) &&
            building.tileArray.length > 0
        )
    }

    getTile(tileOrKey) {
        const tileKey = normalizeTileKey(tileOrKey)
        if (tileKey === null) {
            return null
        }

        if (typeof this.cave?.getTile !== 'function') {
            return null
        }

        return this.cave.getTile(tileKey) ?? null
    }

    isTileInCoverage(tileOrKey) {
        const tile = this.getTile(tileOrKey)
        if (!tile) {
            return false
        }

        if (this.type === 'building') {
            return this.hasActiveBuildingTarget() && this.cave?.isTileReachable?.(tile) === true
        }

        return this.cave?.isTileRevealed?.(tile) === true
    }

    getCoverageTiles() {
        if (!this.cave) {
            return []
        }

        if (this.type === 'building') {
            if (!this.hasActiveBuildingTarget()) {
                return []
            }

            return typeof this.cave.getReachableTiles === 'function'
                ? this.cave.getReachableTiles()
                : []
        }

        if (typeof this.cave.getTiles !== 'function') {
            return []
        }

        return this.cave.getTiles().filter((tile) => this.isTileInCoverage(tile))
    }

    createBaseField() {
        const field = new Map()

        for (const tile of this.getCoverageTiles()) {
            field.set(tile.key, Infinity)
        }

        return field
    }

    syncCoverage(field = this.field) {
        if (!(field instanceof Map)) {
            return null
        }

        for (const tileKey of [...field.keys()]) {
            if (!this.isTileInCoverage(tileKey)) {
                field.delete(tileKey)
            }
        }

        for (const tile of this.getCoverageTiles()) {
            if (!field.has(tile.key)) {
                field.set(tile.key, Infinity)
            }
        }

        return field
    }

    addAdjacentPassableSeeds(tile, blockedKeys, seedKeys) {
        if (!tile) {
            return
        }

        for (const neighbor of tile.getNeighbors()) {
            if (!this.isTileInCoverage(neighbor) || !neighbor?.creatureFits() || blockedKeys.has(neighbor.key)) {
                continue
            }

            seedKeys.add(neighbor.key)
        }
    }

    addBuildingTargets(building, blockedKeys, seedKeys, { blockPassableTiles = false } = {}) {
        if (!building || !Array.isArray(building.tileArray) || building.tileArray.length === 0) {
            return
        }

        for (const tile of building.tileArray) {
            if (!tile) {
                continue
            }

            const shouldBlockTile = blockPassableTiles || !tile.creatureFits()
            if (!shouldBlockTile) {
                continue
            }

            blockedKeys.add(tile.key)
            this.addAdjacentPassableSeeds(tile, blockedKeys, seedKeys)
        }
    }

    buildBuildingSeedKeys(building) {
        const seedKeys = new Set()
        if (!building || !Array.isArray(building.tileArray) || building.tileArray.length === 0) {
            return seedKeys
        }

        for (const tile of building.tileArray) {
            if (!tile?.creatureFits() || !this.isTileInCoverage(tile)) {
                continue
            }

            seedKeys.add(tile.key)
        }

        if (seedKeys.size > 0) {
            return seedKeys
        }

        for (const tile of building.tileArray) {
            if (!tile) {
                continue
            }

            for (const neighbor of tile.getNeighbors()) {
                if (!neighbor?.creatureFits() || !this.isTileInCoverage(neighbor)) {
                    continue
                }

                seedKeys.add(neighbor.key)
            }
        }

        return seedKeys
    }

    buildSnapshot() {
        const blockedKeys = new Set()
        const seedKeys = new Set()
        const trackedBuildings = []
        const trackedCreatures = []

        if (!this.cave) {
            this.setTrackedTargets()
            return {
                blockedKeys,
                seedKeys
            }
        }

        if (typeof this.cave.getTiles === 'function') {
            for (const tile of this.cave.getTiles()) {
                if (!this.isTileInCoverage(tile) || !tile?.creatureFits()) {
                    blockedKeys.add(tile.key)
                }
            }
        }

        if (this.type === 'building') {
            const building = this.getOwnerBuilding()
            if (this.hasActiveBuildingTarget()) {
                trackedBuildings.push(building)

                for (const seedKey of this.buildBuildingSeedKeys(building)) {
                    seedKeys.add(seedKey)
                }
            }
        } else if (this.type === 'enemy') {
            for (const creature of this.cave.enemies ?? []) {
                trackedCreatures.push(creature)
                const tile = this.getTile(toKey(creature.location))
                if (!tile) {
                    continue
                }

                blockedKeys.add(tile.key)
                this.addAdjacentPassableSeeds(tile, blockedKeys, seedKeys)
            }
        } else if (this.type === 'colony') {
            for (const creature of this.cave.trilobites ?? []) {
                trackedCreatures.push(creature)
                const tile = this.getTile(toKey(creature.location))
                if (!tile) {
                    continue
                }

                blockedKeys.add(tile.key)
                this.addAdjacentPassableSeeds(tile, blockedKeys, seedKeys)
            }

            for (const building of this.cave.buildings ?? []) {
                if (!building) {
                    continue
                }

                trackedBuildings.push(building)
                const isAlgaeFarm = building?.name === 'Algae Farm' || building?.constructor?.name === 'AlgaeFarm'
                this.addBuildingTargets(building, blockedKeys, seedKeys, {
                    blockPassableTiles: isAlgaeFarm
                })
            }
        }

        this.setTrackedTargets({
            buildings: trackedBuildings,
            creatures: trackedCreatures
        })

        return {
            blockedKeys,
            seedKeys
        }
    }

    computeValue(tileKey, field, snapshot) {
        const tile = this.getTile(tileKey)
        if (!tile || !this.isTileInCoverage(tile) || snapshot.blockedKeys.has(tileKey)) {
            return Infinity
        }

        if (snapshot.seedKeys.has(tileKey)) {
            return 0
        }

        let bestNeighborValue = Infinity

        for (const neighbor of tile.getNeighbors()) {
            if (!this.isTileInCoverage(neighbor) || snapshot.blockedKeys.has(neighbor.key)) {
                continue
            }

            const neighborValue = field.get(neighbor.key) ?? Infinity
            if (neighborValue < bestNeighborValue) {
                bestNeighborValue = neighborValue
            }
        }

        if (!Number.isFinite(bestNeighborValue)) {
            return Infinity
        }

        return bestNeighborValue + 1
    }

    rebuild() {
        const snapshot = this.buildSnapshot()
        const field = this.createBaseField()
        const queue = []
        let queueHead = 0

        for (const seedKey of snapshot.seedKeys) {
            if (snapshot.blockedKeys.has(seedKey) || !field.has(seedKey)) {
                continue
            }

            field.set(seedKey, 0)
            queue.push(seedKey)
        }

        while (queueHead < queue.length) {
            const currentKey = queue[queueHead]
            queueHead++

            const currentTile = this.getTile(currentKey)
            if (!currentTile) {
                continue
            }

            const currentValue = field.get(currentKey) ?? Infinity
            if (!Number.isFinite(currentValue)) {
                continue
            }

            for (const neighbor of currentTile.getNeighbors()) {
                if (!this.isTileInCoverage(neighbor) || snapshot.blockedKeys.has(neighbor.key)) {
                    continue
                }

                const nextValue = currentValue + 1
                if (nextValue >= (field.get(neighbor.key) ?? Infinity)) {
                    continue
                }

                field.set(neighbor.key, nextValue)
                queue.push(neighbor.key)
            }
        }

        return this.commitField(field)
    }

    rebalance(dirtyKeys = this.getUpdatedTileKeys()) {
        if (!(this.field instanceof Map) || this.field.size === 0 || !Array.isArray(dirtyKeys) || dirtyKeys.length === 0) {
            return this.rebuild()
        }

        const field = this.syncCoverage(this.field)
        const snapshot = this.buildSnapshot()
        const queue = []
        const queued = new Set()
        let queueHead = 0

        const enqueue = (tileKey) => {
            const normalizedTileKey = normalizeTileKey(tileKey)
            if (normalizedTileKey === null || queued.has(normalizedTileKey)) {
                return
            }

            const tile = this.getTile(normalizedTileKey)
            if (!tile || !this.isTileInCoverage(tile)) {
                return
            }

            queued.add(normalizedTileKey)
            queue.push(normalizedTileKey)
        }

        for (const dirtyKey of dirtyKeys) {
            const tile = this.getTile(dirtyKey)
            if (!tile) {
                continue
            }

            enqueue(tile.key)
            for (const neighbor of tile.getNeighbors()) {
                enqueue(neighbor.key)
            }
        }

        while (queueHead < queue.length) {
            const currentKey = queue[queueHead]
            queueHead++
            queued.delete(currentKey)

            const currentValue = field.get(currentKey) ?? Infinity
            const nextValue = this.computeValue(currentKey, field, snapshot)
            if (Object.is(currentValue, nextValue)) {
                continue
            }

            field.set(currentKey, nextValue)

            const currentTile = this.getTile(currentKey)
            if (!currentTile) {
                continue
            }

            for (const neighbor of currentTile.getNeighbors()) {
                enqueue(neighbor.key)
            }
        }

        return this.commitField(field)
    }

    refresh() {
        if (!(this.field instanceof Map) || this.field.size === 0) {
            return this.rebuild()
        }

        if (this.isUpdated()) {
            return this.field
        }

        const dirtyKeys = this.getUpdatedTileKeys()
        if (dirtyKeys.length === 0) {
            return this.rebuild()
        }

        return this.rebalance(dirtyKeys)
    }

    getFieldValue(location, { refresh = true } = {}) {
        const field = this.getField({ refresh })
        if (!(field instanceof Map) || !location) {
            return Infinity
        }

        const key = toKey(location)
        return key === null ? Infinity : (field.get(key) ?? Infinity)
    }

    getNextStep(location, { refresh = true } = {}) {
        const field = this.getField({ refresh })
        if (!(field instanceof Map) || !location) {
            return null
        }

        const currentKey = toKey(location)
        const currentTile = this.getTile(currentKey)
        if (!currentTile) {
            return null
        }

        const currentValue = field.get(currentKey) ?? Infinity
        let bestNeighbor = null
        let bestValue = currentValue

        for (const neighbor of currentTile.getNeighbors()) {
            if (!neighbor.creatureFits()) {
                continue
            }

            const neighborValue = field.get(neighbor.key) ?? Infinity
            if (!Number.isFinite(neighborValue) || neighborValue >= bestValue) {
                continue
            }

            if (bestNeighbor === null || neighborValue < bestValue || (neighborValue === bestValue && neighbor.key < bestNeighbor.key)) {
                bestNeighbor = neighbor
                bestValue = neighborValue
            }
        }

        return bestNeighbor ? toCoords(bestNeighbor.key) : null
    }

    buildPathFrom(startLocation, { refresh = true } = {}) {
        const field = this.getField({ refresh })
        if (!(field instanceof Map) || !startLocation) {
            return null
        }

        const startKey = toKey(startLocation)
        const startValue = field.get(startKey) ?? Infinity
        if (!Number.isFinite(startValue)) {
            return null
        }

        const path = [{ x: startLocation.x, y: startLocation.y, type: 'move' }]
        let currentLocation = { x: startLocation.x, y: startLocation.y }
        let currentValue = startValue
        let timeCount = 0

        while (currentValue > 0 && timeCount < 7850) {
            const nextLocation = this.getNextStep(currentLocation, { refresh: false })
            if (!nextLocation) {
                return null
            }

            path.push({ x: nextLocation.x, y: nextLocation.y, type: 'move' })
            currentLocation = nextLocation
            currentValue = field.get(toKey(currentLocation)) ?? Infinity
            timeCount++
        }

        if (currentValue !== 0) {
            return null
        }

        return path
    }

}
