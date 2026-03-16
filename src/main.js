import * as PIXI from 'pixi.js'
import { Cave } from './cave.js'
import * as BUILD from './building.js'
import { Trilobite } from './trilobite.js'
import { Game } from './game.js'

const app = new PIXI.Application()
let gamePaused = true

function formatInventory(inv) {
    if (!inv || inv.amount <= 0 || !inv.type) {
        return 'empty'
    }
    return `${inv.amount} ${inv.type}`
}

function logTickState(cave, tickCount) {
    console.log(`=== Tick ${tickCount} ===`)

    for (const creature of cave.creatures) {
        const inv = typeof creature.getInventory === 'function' ? creature.getInventory() : null
        const invText = formatInventory(inv)
        console.log(`Trilobite ${creature.name}: inv=${invText}, loc=${creature.location.x},${creature.location.y}`)
    }

    let postIndex = 1
    for (const building of cave.buildings) {
        if (!(building instanceof BUILD.MiningPost)) {
            continue
        }
        const postInv = JSON.stringify(building.getInventory())
        const postTotal = building.getInventoryTotal()
        const postCap = building.getCapacity()
        console.log(`Mining Post ${postIndex}: inv=${postInv}, total=${postTotal}/${postCap}, loc=${building.location.x},${building.location.y}`)
        postIndex++
    }
}

function toTileKey(location) {
    return `${location.x},${location.y}`
}

function cloneLocation(location) {
    return { x: location.x, y: location.y }
}

function serializeBuilding(building) {
    return {
        name: building.name,
        size: {
            x: building.size.x,
            y: building.size.y
        },
        openMap: building.openMap.map((row) => [...row])
    }
}

async function setup() {
    await app.init({ background: '#000000', height: window.innerHeight - 5, width: window.innerWidth })
    document.body.appendChild(app.canvas)
}

async function preload() {
    const base = import.meta.env.BASE_URL

    const assets = [
        { alias: 'empty', src: `${base}assets/EmptyTile.png` },
        { alias: 'wall', src: `${base}assets/CaveWall.png` },
        { alias: 'Algae', src: `${base}assets/AlgaeTile.png` },
        { alias: 'Sandstone', src: `${base}assets/SandTile.png` },
        { alias: 'Malachite', src: `${base}assets/MalachiteTile.png` },
        { alias: 'Magnetite', src: `${base}assets/MagnetiteTile.png` },
        { alias: 'Perotene', src: `${base}assets/PeroteneTile.png` },
        { alias: 'Ilmenite', src: `${base}assets/IlmeniteTile.png` },
        { alias: 'Cochinium', src: `${base}assets/CochiniumTile.png` },
        { alias: 'Trilobite', src: `${base}assets/Trilobite.png` },

        { alias: 'Scaffold', src: `${base}assets/Scaffold.png` },
        { alias: 'Queen', src: `${base}assets/Queen.png` },
        { alias: 'Algae Farm', src: `${base}assets/AlgaeFarm.png` },
        { alias: 'Storage', src: `${base}assets/Storage.png` },
        { alias: 'Smith', src: `${base}assets/Smith.png` },
        { alias: 'Mining Post', src: `${base}assets/MiningPost.png` },

        { alias: 'path', src: `${base}assets/Path.png` },
        { alias: 'orepath', src: `${base}assets/OrePath.png` },
        { alias: 'selected', src: `${base}assets/Selected.png` },
        { alias: 'selectededge', src: `${base}assets/SelectedEdge.png` },

        { alias: 'menu', src: `${base}assets/MenuBlock.png` },
        { alias: 'window_5x4', src: `${base}assets/window_5x4.png` },
        { alias: 'window_4x1', src: `${base}assets/window_4x1.png` },
        { alias: 'window_3x1', src: `${base}assets/window_3x1.png` },
        { alias: 'back', src: `${base}assets/BackArrow.png` }
    ]

    await PIXI.Assets.load(assets)
}

;(async () => {
    await setup()
    await preload()

    const game = new Game(app)
    const cave = new Cave(app, game)

    const creaturesById = new Map()
    const buildingsById = new Map()

    let nextCreatureId = 1
    let nextBuildingId = 1
    let nextBuildRequestId = 1

    const pendingBuildRequests = new Map()
    const pendingWorkerPaths = new Map()

    let simulationWorker = null
    let pixiWorker = null

    const registerCreature = (creature) => {
        if (!creature) {
            return null
        }

        if (typeof creature.threadId !== 'string' || creature.threadId.length === 0) {
            creature.threadId = `creature-${nextCreatureId}`
            nextCreatureId++
        }
        creaturesById.set(creature.threadId, creature)
        return creature.threadId
    }

    const registerBuilding = (building, preferredId = null) => {
        if (!building) {
            return null
        }

        if (typeof preferredId === 'string' && preferredId.length > 0) {
            building.threadId = preferredId
        }

        if (typeof building.threadId !== 'string' || building.threadId.length === 0) {
            building.threadId = `building-${nextBuildingId}`
            nextBuildingId++
        }
        buildingsById.set(building.threadId, building)
        return building.threadId
    }

    const snapshotTiles = () => {
        const tiles = []
        for (const tile of cave.getTiles()) {
            tiles.push({
                key: tile.key,
                base: tile.getBase(),
                creatureCanFit: tile.creatureFits(),
                built: tile.getBuilt() ? 'occupied' : null
            })
        }
        return tiles
    }

    const snapshotCreatures = () => {
        const creatures = []
        for (const [id, creature] of creaturesById.entries()) {
            creatures.push({
                id,
                location: cloneLocation(creature.location)
            })
        }
        return creatures
    }

    const snapshotBuildings = () => {
        const buildings = []
        for (const [id, building] of buildingsById.entries()) {
            buildings.push({
                id,
                name: building.name,
                location: cloneLocation(building.location),
                size: { x: building.size.x, y: building.size.y },
                openMap: building.openMap.map((row) => [...row])
            })
        }
        return buildings
    }

    const originalSpawn = cave.spawn.bind(cave)
    cave.spawn = (creature, tile) => {
        const spawned = originalSpawn(creature, tile)
        if (!spawned) {
            return false
        }

        const creatureId = registerCreature(creature)
        const creatureSnapshot = {
            id: creatureId,
            location: cloneLocation(creature.location)
        }

        if (simulationWorker) {
            simulationWorker.postMessage({
                type: 'registerCreature',
                creature: creatureSnapshot
            })
        }
        if (pixiWorker) {
            pixiWorker.postMessage({
                type: 'registerCreature',
                creature: creatureSnapshot
            })
        }

        return true
    }

    const originalBuild = cave.build.bind(cave)
    cave.build = (building, location, sprite) => {
        const built = originalBuild(building, location, sprite)
        if (built) {
            registerBuilding(building)
        }
        return built
    }

    const applyCreatureMoveCommand = (command) => {
        const creature = creaturesById.get(command.creatureId)
        if (!creature) {
            return
        }

        const tile = cave.getTile(toTileKey(command.location))
        if (!tile || !tile.sprite) {
            return
        }

        creature.location = cloneLocation(command.location)
        creature.sprite.x = tile.sprite.x
        creature.sprite.y = tile.sprite.y
        creature.sprite.baseX = tile.sprite.baseX
        creature.sprite.baseY = tile.sprite.baseY

        if (Number.isFinite(command.rotation)) {
            creature.sprite.rotation = command.rotation
        }

        if (creature.pathPreview.length > 0) {
            const nextQueued = creature.pathPreview[0]
            if (nextQueued.x === command.location.x && nextQueued.y === command.location.y) {
                creature.pathPreview.shift()
            }
        }
    }

    const handleBuildResult = (result) => {
        const pending = pendingBuildRequests.get(result.requestId)
        if (!pending) {
            return
        }
        pendingBuildRequests.delete(result.requestId)

        if (!result.accepted) {
            return
        }

        const { cave: requestCave, building, sprite, location } = pending
        const buildLocation = result.location ?? location

        registerBuilding(building, result.buildingId)

        if (sprite && sprite.parent) {
            sprite.parent.removeChild(sprite)
        }

        const built = requestCave.build(building, buildLocation, sprite)
        if (!built) {
            if (sprite && !sprite.parent) {
                game.tileContainer.addChild(sprite)
            }
            return
        }

        game.floatingBuilding.sprite = null
        game.floatingBuilding.building = null
        game.buildMode = false
        game.cleanActive()

        if (pixiWorker) {
            pixiWorker.postMessage({
                type: 'simulationUpdates',
                updates: [{
                    type: 'buildPlaced',
                    requestId: result.requestId,
                    buildingId: result.buildingId,
                    location: buildLocation
                }]
            })
        }
    }

    let queen = new BUILD.Queen()
    let spawnX = Math.floor((Math.random() * 20) - 10)
    let spawnY = Math.floor((Math.random() * 20) - 10)

    while (!cave.build(queen, { x: spawnX, y: spawnY }, queen.sprite)) {
        spawnX = Math.floor((Math.random() * 20) - 10)
        spawnY = Math.floor((Math.random() * 20) - 10)
    }

    let trilo = new Trilobite('Jeffery', { x: spawnX + 2, y: spawnY }, game)
    cave.spawn(trilo, cave.getTile((spawnX + 2) + ',' + spawnY))

    trilo = new Trilobite('Quinton', { x: spawnX + 2, y: spawnY + 2 }, game)
    cave.spawn(trilo, cave.getTile((spawnX + 2) + ',' + (spawnY + 2)))

    trilo = new Trilobite('Yeetmuncher', { x: spawnX, y: spawnY }, game)
    cave.spawn(trilo, cave.getTile(spawnX + ',' + spawnY))

    trilo = new Trilobite('Sigma', { x: spawnX, y: spawnY + 2 }, game)
    cave.spawn(trilo, cave.getTile(spawnX + ',' + (spawnY + 2)))

    simulationWorker = new Worker(new URL('./workers/simulation.worker.js', import.meta.url), { type: 'module' })
    pixiWorker = new Worker(new URL('./workers/pixi-manager.worker.js', import.meta.url), { type: 'module' })

    simulationWorker.addEventListener('message', (event) => {
        const message = event.data
        if (!message || typeof message.type !== 'string') {
            return
        }

        if (message.type === 'simulationUpdates') {
            pixiWorker.postMessage({
                type: 'simulationUpdates',
                updates: message.updates
            })
            return
        }

        if (message.type === 'buildResult') {
            handleBuildResult(message)
            return
        }

        if (message.type === 'pathQueueResult') {
            if (message.accepted) {
                pendingWorkerPaths.delete(message.creatureId)
                return
            }

            const pendingPath = pendingWorkerPaths.get(message.creatureId)
            if (pendingPath && pendingPath.retries < 1 && message.reason === 'Creature not registered.') {
                const creature = creaturesById.get(message.creatureId)
                if (creature) {
                    pendingPath.retries++
                    const creatureSnapshot = {
                        id: creature.threadId,
                        location: cloneLocation(creature.location)
                    }
                    simulationWorker.postMessage({
                        type: 'registerCreature',
                        creature: creatureSnapshot
                    })
                    pixiWorker.postMessage({
                        type: 'registerCreature',
                        creature: creatureSnapshot
                    })
                    simulationWorker.postMessage({
                        type: 'queueMovePath',
                        creatureId: creature.threadId,
                        path: pendingPath.path
                    })
                    return
                }
            }

            pendingWorkerPaths.delete(message.creatureId)
            if (!message.accepted) {
                console.warn(`Failed to queue movement path for ${message.creatureId}: ${message.reason}`)
            }
        }
    })

    pixiWorker.addEventListener('message', (event) => {
        const message = event.data
        if (!message || message.type !== 'renderCommands' || !Array.isArray(message.commands)) {
            return
        }

        for (const command of message.commands) {
            if (command.type === 'moveCreatureSprite') {
                applyCreatureMoveCommand(command)
            } else if (command.type === 'clearCreaturePath') {
                const creature = creaturesById.get(command.creatureId)
                if (creature) {
                    creature.pathPreview = []
                }
            }
        }
    })

    simulationWorker.postMessage({
        type: 'init',
        tiles: snapshotTiles(),
        creatures: snapshotCreatures(),
        buildings: snapshotBuildings()
    })
    pixiWorker.postMessage({
        type: 'init',
        creatures: snapshotCreatures(),
        buildings: snapshotBuildings()
    })

    game.onQueueMovePath = ({ creature, path }) => {
        if (!creature || typeof creature.threadId !== 'string') {
            return false
        }

        const workerPath = path.map((step) => ({
            x: step.x,
            y: step.y
        }))
        pendingWorkerPaths.set(creature.threadId, {
            path: workerPath,
            retries: 0
        })

        creature.clearActionQueue()
        creature.pathPreview = workerPath.slice(1).map((step) => ({
            x: step.x,
            y: step.y
        }))

        const creatureSnapshot = {
            id: creature.threadId,
            location: cloneLocation(creature.location)
        }
        simulationWorker.postMessage({
            type: 'registerCreature',
            creature: creatureSnapshot
        })
        pixiWorker.postMessage({
            type: 'registerCreature',
            creature: creatureSnapshot
        })

        simulationWorker.postMessage({
            type: 'queueMovePath',
            creatureId: creature.threadId,
            path: workerPath
        })
        return true
    }

    game.onBuildRequest = ({ cave: buildCave, building, sprite, location }) => {
        if (!buildCave || !building || !sprite || !location) {
            return false
        }
        if (pendingBuildRequests.size > 0) {
            return true
        }

        const requestId = `build-request-${nextBuildRequestId}`
        nextBuildRequestId++

        pendingBuildRequests.set(requestId, {
            cave: buildCave,
            building,
            sprite,
            location: cloneLocation(location)
        })

        simulationWorker.postMessage({
            type: 'buildRequest',
            requestId,
            building: serializeBuilding(building),
            location: cloneLocation(location)
        })
        return true
    }

    game.onTilesChanged = (tileUpdates) => {
        simulationWorker.postMessage({
            type: 'syncTiles',
            tiles: tileUpdates
        })
    }

    game.totalXDelt = spawnX * 80 + 80
    game.totalYDelt = spawnY * 80 + 80

    for (const child of game.tileContainer.children) {
        child.baseX = child.baseX - game.totalXDelt
        child.baseY = child.baseY - game.totalYDelt
        child.x = child.position.x - game.totalXDelt
        child.y = child.position.y - game.totalYDelt
    }

    let tickCount = 0
    const runTick = () => {
        tickCount++
        const tickStart = performance.now()

        // Movement simulation is worker-authoritative.
        simulationWorker.postMessage({ type: 'tick' })

        console.log(`Creature loop time: ${(performance.now() - tickStart).toFixed(3)} ms`)
    }

    let tickSpeedMs = 250
    const tickLoop = () => {
        if (!gamePaused) {
            runTick()
        }
        setTimeout(tickLoop, tickSpeedMs)
    }
    tickLoop()

    window.addEventListener('wheel', (event) => {
        if (game.dragging) {
            return
        }
        if (event.deltaY < 0) {
            if (game.currentScale < 2.5) {
                game.currentScale = game.currentScale * (4 / 3)
            } else {
                return
            }
        } else if (game.currentScale > 0.1) {
            game.currentScale = game.currentScale * 0.75
        } else {
            return
        }
        for (const child of game.tileContainer.children) {
            child.scale.set(game.currentScale)
            if (child === game.floatingBuilding.sprite) {
                continue
            }
            child.x = game.midx + ((child.baseX - game.midx) * game.currentScale)
            child.y = game.midy + ((child.baseY - game.midy) * game.currentScale)
        }
    })

    window.addEventListener('mousedown', (e) => {
        const rect = app.canvas.getBoundingClientRect()
        game.dragStartPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }
        game.dragging = false
    })

    window.addEventListener('mousemove', (e) => {
        const rect = app.canvas.getBoundingClientRect()
        const pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }

        if (game.dragStartPos !== null) {
            const dx = pos.x - game.dragStartPos.x
            const dy = pos.y - game.dragStartPos.y
            const dist = Math.sqrt((dx * dx) + (dy * dy))

            if (dist > 10) {
                game.dragging = true
                for (const child of game.tileContainer.children) {
                    if (child === game.floatingBuilding.sprite) {
                        continue
                    }
                    child.x = game.midx + ((child.baseX - game.midx) * game.currentScale) + dx
                    child.y = game.midy + ((child.baseY - game.midy) * game.currentScale) + dy
                }
            }
        }

        if (game.buildMode) {
            game.floatingBuilding.sprite.x = pos.x
            game.floatingBuilding.sprite.y = pos.y
            game.floatingBuilding.sprite.baseX = ((pos.x - game.floatingBuilding.sprite.position.baseX) * (1 / game.currentScale))
            game.floatingBuilding.sprite.baseY = ((pos.y - game.floatingBuilding.sprite.position.baseY) * (1 / game.currentScale))
        }
    })

    window.addEventListener('mouseup', (e) => {
        const rect = app.canvas.getBoundingClientRect()
        const pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }

        if (game.dragging) {
            const dx = (pos.x - game.dragStartPos.x) * (1 / game.currentScale)
            const dy = (pos.y - game.dragStartPos.y) * (1 / game.currentScale)

            game.totalXDelt -= dx
            game.totalYDelt -= dy

            for (const child of game.tileContainer.children) {
                child.baseX = child.baseX + dx
                child.baseY = child.baseY + dy
            }
        }

        game.dragStartPos = null
        game.dragging = false
    })

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            runTick()
        } else if (e.code === 'Space') {
            e.preventDefault()
            if (e.repeat) {
                return
            }
            gamePaused = !gamePaused
        } else if (e.key === '1') {
            tickSpeedMs = 500
        } else if (e.key === '2') {
            tickSpeedMs = 250
        } else if (e.key === '3') {
            tickSpeedMs = 100
        } else if (e.key === '4') {
            tickSpeedMs = 50
        } else if (e.key === 'p' || e.key === 'P') {
            logTickState(cave, tickCount)
        } else if (e.key === 'Escape') {
            game.cleanActive()
        } else if (e.key === 'r' && game.buildMode) {
            game.floatingBuilding.sprite.rotation += Math.PI / 2
            game.floatingBuilding.building.rotateMap()

            if (game.floatingBuilding.rotation == 0) {
                game.floatingBuilding.rotation++
                game.floatingBuilding.sprite.anchor.set(1 / (game.floatingBuilding.building.size.x * 2), ((game.floatingBuilding.building.size.y * 2) - 1) / (game.floatingBuilding.building.size.y * 2))
            } else if (game.floatingBuilding.rotation == 1) {
                game.floatingBuilding.rotation++
                game.floatingBuilding.sprite.anchor.set((((game.floatingBuilding.building.size.x * 2) - 1) / (game.floatingBuilding.building.size.x * 2)), (((game.floatingBuilding.building.size.y * 2) - 1) / (game.floatingBuilding.building.size.y * 2)))
            } else if (game.floatingBuilding.rotation == 2) {
                game.floatingBuilding.rotation++
                game.floatingBuilding.sprite.anchor.set((((game.floatingBuilding.building.size.x * 2) - 1) / (game.floatingBuilding.building.size.x * 2)), (1 / (game.floatingBuilding.building.size.y * 2)))
            } else if (game.floatingBuilding.rotation == 3) {
                game.floatingBuilding.rotation = 0
                game.floatingBuilding.sprite.anchor.set((1 / (game.floatingBuilding.building.size.x * 2)), (1 / (game.floatingBuilding.building.size.y * 2)))
            }
        }
    })
})()
