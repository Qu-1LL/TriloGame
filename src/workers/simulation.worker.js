function toKey(location) {
    return `${location.x},${location.y}`
}

function toCoords(coords) {
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
        return { x: coords.x, y: coords.y }
    }
    if (typeof coords !== 'string') {
        return null
    }
    const [x, y] = coords.split(',').map(Number)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
    }
    return { x, y }
}

function cloneLocation(location) {
    return { x: location.x, y: location.y }
}

function computeRotation(from, to) {
    const dx = to.x - from.x
    const dy = to.y - from.y

    if (dx === 0) {
        return dy === 1 ? Math.PI : 0
    }
    return dx === 1 ? (Math.PI / 2) : (Math.PI * 1.5)
}

const state = {
    tiles: new Map(),
    creatures: new Map(),
    buildings: new Map(),
    nextBuildingId: 1
}

function clearState() {
    state.tiles.clear()
    state.creatures.clear()
    state.buildings.clear()
    state.nextBuildingId = 1
}

function setTile(tile) {
    if (!tile || typeof tile.key !== 'string') {
        return
    }

    const previous = state.tiles.get(tile.key)
    state.tiles.set(tile.key, {
        key: tile.key,
        base: tile.base ?? previous?.base ?? 'empty',
        creatureCanFit: Boolean(tile.creatureCanFit ?? previous?.creatureCanFit),
        built: tile.built ?? previous?.built ?? null
    })
}

function applyTileUpdates(tileUpdates) {
    if (!Array.isArray(tileUpdates)) {
        return
    }
    for (const tile of tileUpdates) {
        setTile(tile)
    }
}

function registerCreature(creature) {
    if (!creature || typeof creature.id !== 'string') {
        return
    }
    const location = toCoords(creature.location)
    if (!location) {
        return
    }

    const existing = state.creatures.get(creature.id)
    state.creatures.set(creature.id, {
        id: creature.id,
        location,
        queuedPath: existing?.queuedPath ?? []
    })
}

function unregisterCreature(creatureId) {
    if (typeof creatureId !== 'string') {
        return
    }
    state.creatures.delete(creatureId)
}

function registerBuilding(building) {
    if (!building || typeof building.id !== 'string') {
        return
    }

    const size = building.size ?? { x: 1, y: 1 }
    const openMap = Array.isArray(building.openMap) ? building.openMap : [[0]]
    const location = toCoords(building.location)

    state.buildings.set(building.id, {
        id: building.id,
        name: building.name ?? 'Building',
        size: { x: size.x, y: size.y },
        openMap: openMap.map((row) => [...row]),
        location
    })
}

function setInitialState(payload) {
    clearState()

    applyTileUpdates(payload.tiles)

    if (Array.isArray(payload.creatures)) {
        for (const creature of payload.creatures) {
            registerCreature(creature)
        }
    }

    if (Array.isArray(payload.buildings)) {
        for (const building of payload.buildings) {
            registerBuilding(building)
            const numeric = Number.parseInt((building.id ?? '').replace('building-', ''), 10)
            if (Number.isFinite(numeric)) {
                state.nextBuildingId = Math.max(state.nextBuildingId, numeric + 1)
            }
        }
    }
}

function isTilePassable(key) {
    const tile = state.tiles.get(key)
    return Boolean(tile && tile.creatureCanFit)
}

function queueMovePath(creatureId, path) {
    const creature = state.creatures.get(creatureId)
    if (!creature) {
        return {
            accepted: false,
            reason: 'Creature not registered.',
            queueLength: 0
        }
    }

    const normalizedPath = []
    if (!Array.isArray(path)) {
        return {
            accepted: false,
            reason: 'Path payload was not an array.',
            queueLength: 0
        }
    }

    for (const step of path) {
        const coords = toCoords(step)
        if (!coords) {
            continue
        }
        normalizedPath.push(coords)
    }

    if (normalizedPath.length > 0) {
        const first = normalizedPath[0]
        if (first.x === creature.location.x && first.y === creature.location.y) {
            normalizedPath.shift()
        }
    }

    creature.queuedPath = normalizedPath
    return {
        accepted: true,
        reason: null,
        queueLength: normalizedPath.length
    }
}

function syncCreatureLocations(creatures) {
    if (!Array.isArray(creatures)) {
        return
    }

    for (const creature of creatures) {
        if (!creature || typeof creature.id !== 'string') {
            continue
        }
        const location = toCoords(creature.location)
        if (!location) {
            continue
        }

        const existing = state.creatures.get(creature.id)
        if (!existing) {
            registerCreature(creature)
            continue
        }
        existing.location = location
    }
}

function canPlaceBuilding(building, location) {
    if (!building || !location) {
        return false
    }

    for (let x = 0; x < building.size.x; x++) {
        for (let y = 0; y < building.size.y; y++) {
            const key = `${location.x + x},${location.y + y}`
            const tile = state.tiles.get(key)
            if (!tile) {
                return false
            }
            if (tile.base !== 'empty' || !tile.creatureCanFit || tile.built !== null) {
                return false
            }
        }
    }

    return true
}

function commitBuilding(buildingId, building, location) {
    for (let x = 0; x < building.size.x; x++) {
        for (let y = 0; y < building.size.y; y++) {
            const key = `${location.x + x},${location.y + y}`
            const tile = state.tiles.get(key)
            if (!tile) {
                continue
            }
            if (building.openMap[y][x] > 1) {
                continue
            }
            tile.built = buildingId
            tile.creatureCanFit = building.openMap[y][x] >= 1
        }
    }
}

function getNextBuildingId() {
    const id = `building-${state.nextBuildingId}`
    state.nextBuildingId++
    return id
}

function processBuildRequest(message) {
    const requestId = message.requestId
    const building = message.building
    const location = toCoords(message.location)

    if (!requestId || !building || !location) {
        postMessage({
            type: 'buildResult',
            requestId,
            accepted: false,
            reason: 'Invalid build request payload.'
        })
        return
    }

    if (!canPlaceBuilding(building, location)) {
        postMessage({
            type: 'buildResult',
            requestId,
            accepted: false,
            reason: 'Cannot place building at requested location.'
        })
        return
    }

    const buildingId = (typeof message.buildingId === 'string' && message.buildingId.length > 0)
        ? message.buildingId
        : getNextBuildingId()

    registerBuilding({
        id: buildingId,
        name: building.name,
        size: building.size,
        openMap: building.openMap,
        location
    })
    commitBuilding(buildingId, building, location)

    postMessage({
        type: 'buildResult',
        requestId,
        accepted: true,
        buildingId,
        location
    })
}

function runTick() {
    const updates = []

    for (const creature of state.creatures.values()) {
        if (!Array.isArray(creature.queuedPath) || creature.queuedPath.length === 0) {
            continue
        }

        const next = creature.queuedPath[0]
        const current = creature.location
        const stepDistance = Math.abs(current.x - next.x) + Math.abs(current.y - next.y)
        const nextKey = toKey(next)

        if (stepDistance !== 1 || !isTilePassable(nextKey)) {
            creature.queuedPath = []
            updates.push({
                type: 'movementBlocked',
                creatureId: creature.id,
                location: cloneLocation(current)
            })
            continue
        }

        creature.queuedPath.shift()
        creature.location = cloneLocation(next)

        updates.push({
            type: 'creatureMoved',
            creatureId: creature.id,
            location: cloneLocation(next),
            rotation: computeRotation(current, next)
        })
    }

    if (updates.length > 0) {
        postMessage({
            type: 'simulationUpdates',
            updates
        })
    }
}

self.addEventListener('message', (event) => {
    const message = event.data
    if (!message || typeof message.type !== 'string') {
        return
    }

    switch (message.type) {
    case 'init': {
        setInitialState(message)
        break
    }
    case 'tick': {
        runTick()
        break
    }
    case 'queueMovePath': {
        if (typeof message.creatureId !== 'string') {
            break
        }
        const result = queueMovePath(message.creatureId, message.path)
        postMessage({
            type: 'pathQueueResult',
            creatureId: message.creatureId,
            accepted: result.accepted,
            reason: result.reason,
            queueLength: result.queueLength
        })
        break
    }
    case 'syncCreatureLocations': {
        syncCreatureLocations(message.creatures)
        break
    }
    case 'registerCreature': {
        registerCreature(message.creature)
        break
    }
    case 'unregisterCreature': {
        unregisterCreature(message.creatureId)
        break
    }
    case 'syncTiles': {
        applyTileUpdates(message.tiles)
        break
    }
    case 'buildRequest': {
        processBuildRequest(message)
        break
    }
    default:
        break
    }
})
