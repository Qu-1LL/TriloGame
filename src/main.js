
import * as PIXI from 'pixi.js'
import { Cave, toCoords } from './cave.js'
import { MiningPost } from './buildings/mining-post.js'
import { Queen } from './buildings/queen.js'
import { Creature } from './creature.js'
import { Enemy } from './creatures/enemy.js'
import { Trilobite } from './creatures/trilobite.js'
import { Game } from './game.js'

const app = new PIXI.Application();
let gamePaused = true
const VIEWPORT_MARGIN_X = 0
const VIEWPORT_MARGIN_Y = 0

function formatInventory(inv) {
    if (!inv || inv.amount <= 0 || !inv.type) {
        return 'empty'
    }
    return `${inv.amount} ${inv.type}`
}

function logTickState(cave, tickCount) {
    console.log(`=== Tick ${tickCount} ===`)

    for (const creature of cave.getCreatures()) {
        const inv = typeof creature.getInventory === 'function' ? creature.getInventory() : null
        const invText = formatInventory(inv)
        const creatureType = creature.constructor?.name ?? 'Creature'
        console.log(`${creatureType} ${creature.name}: inv=${invText}, loc=${creature.location.x},${creature.location.y}`)
    }

    let postIndex = 1
    for (const building of cave.buildings) {
        if (!(building instanceof MiningPost)) {
            continue
        }
        const postInv = JSON.stringify(building.getInventory())
        const postTotal = building.getInventoryTotal()
        const postCap = building.getCapacity()
        console.log(`Mining Post ${postIndex}: inv=${postInv}, total=${postTotal}/${postCap}, loc=${building.location.x},${building.location.y}`)
        postIndex++
    }
}

function formatStatsSnapshot(stats) {
    const entries = Object.entries(stats ?? {})
    if (entries.length === 0) {
        return '  (no stats tracked)'
    }

    const longestKey = entries.reduce((max, [key]) => Math.max(max, key.length), 0)
    return entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `  ${key.padEnd(longestKey)} : ${value}`)
        .join('\n')
}

function logStatsSnapshot(game, tickCount) {
    console.log(`=== Stats At Tick ${tickCount} ===`)
    console.log(formatStatsSnapshot(game.stats.getAll()))
}

function getRandomReachableSpawnTile(cave) {
    const occupiedTileKeys = new Set()
    for (const creature of cave.getCreatures()) {
        if (Number.isFinite(creature?.location?.x) && Number.isFinite(creature?.location?.y)) {
            occupiedTileKeys.add(`${creature.location.x},${creature.location.y}`)
        }
    }

    const reachableTiles = typeof cave.getReachableTiles === 'function'
        ? cave.getReachableTiles().filter((tile) => tile?.creatureFits() && !occupiedTileKeys.has(tile.key))
        : cave.getTiles().filter((tile) => tile?.creatureFits() && !occupiedTileKeys.has(tile.key))

    if (reachableTiles.length === 0) {
        return null
    }

    const randomIndex = Math.floor(Math.random() * reachableTiles.length)
    return reachableTiles[randomIndex]
}

function getManhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function hasWallClearance(cave, building, location, minDistance) {
    if (!cave || !building || !location || !Number.isFinite(minDistance) || minDistance <= 0) {
        return true
    }

    for (let x = 0; x < building.size.x; x++) {
        for (let y = 0; y < building.size.y; y++) {
            if (building.openMap[y][x] > 1) {
                continue
            }

            const tileLocation = {
                x: location.x + x,
                y: location.y + y
            }

            for (let dx = -(minDistance - 1); dx <= (minDistance - 1); dx++) {
                for (let dy = -(minDistance - 1); dy <= (minDistance - 1); dy++) {
                    if ((Math.abs(dx) + Math.abs(dy)) >= minDistance) {
                        continue
                    }

                    const nearbyTile = cave.getTile(`${tileLocation.x + dx},${tileLocation.y + dy}`)
                    if (!nearbyTile || nearbyTile.getBase() === 'wall') {
                        return false
                    }
                }
            }
        }
    }

    return true
}

function findStarterMiningPostLocation(cave, building, minWallDistance = 5, maxQueenDistance = 10) {
    if (!cave || !building) {
        return null
    }

    const queenBuilding = typeof cave.getQueenBuilding === 'function' ? cave.getQueenBuilding() : null
    const queenCenter = typeof queenBuilding?.getCenter === 'function'
        ? queenBuilding.getCenter()
        : { x: 0, y: 0 }

    let bestLocation = null
    let bestDistance = Infinity

    for (const tile of cave.getTiles()) {
        const location = toCoords(tile.key)
        if (!cave.canBuild(building, location)) {
            continue
        }

        if (!hasWallClearance(cave, building, location, minWallDistance)) {
            continue
        }

        const buildingCenter = {
            x: location.x + Math.floor(building.size.x / 2),
            y: location.y + Math.floor(building.size.y / 2)
        }
        const distance = getManhattanDistance(buildingCenter, queenCenter)
        if (Number.isFinite(maxQueenDistance) && maxQueenDistance >= 0 && distance > maxQueenDistance) {
            continue
        }

        if (distance < bestDistance) {
            bestDistance = distance
            bestLocation = location
        }
    }

    return bestLocation
}

function getRandomInitialQueenLocation() {
    return {
        x: Math.floor((Math.random() * 20) - 10),
        y: Math.floor((Math.random() * 20) - 10)
    }
}

function getViewportSize() {
    const root = document.documentElement
    const availableWidth = root?.clientWidth ?? window.innerWidth
    const availableHeight = root?.clientHeight ?? window.innerHeight

    return {
        width: Math.max(320, Math.floor(availableWidth - (VIEWPORT_MARGIN_X * 2))),
        height: Math.max(320, Math.floor(availableHeight - (VIEWPORT_MARGIN_Y * 2)))
    }
}

function applyCanvasViewportStyles(canvas, viewport) {
    if (!canvas || !viewport) {
        return false
    }

    canvas.style.display = 'block'
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    return true
}

function buildInitialColony(cave, game) {
    const starterWallDistance = 5
    const starterQueenDistance = 10
    const randomAttempts = 200

    for (let attempt = 0; attempt < randomAttempts; attempt++) {
        const queenLocation = getRandomInitialQueenLocation()
        const queen = new Queen(game)
        if (!cave.build(queen, queenLocation, queen.sprite)) {
            continue
        }

        const miningPost = new MiningPost(game)
        const miningPostLocation = findStarterMiningPostLocation(cave, miningPost, starterWallDistance, starterQueenDistance)
        if (miningPostLocation && cave.build(miningPost, miningPostLocation, miningPost.sprite)) {
            return {
                queenLocation,
                miningPostLocation
            }
        }

        cave.removeBuilding(queen, 'initialPlacementRetry')
    }

    const candidateQueenLocations = cave.getTiles()
        .map((tile) => toCoords(tile.key))
        .sort((a, b) => getManhattanDistance(a, { x: 0, y: 0 }) - getManhattanDistance(b, { x: 0, y: 0 }))

    for (const queenLocation of candidateQueenLocations) {
        const queen = new Queen(game)
        if (!cave.build(queen, queenLocation, queen.sprite)) {
            continue
        }

        const miningPost = new MiningPost(game)
        const miningPostLocation = findStarterMiningPostLocation(cave, miningPost, starterWallDistance, starterQueenDistance)
        if (miningPostLocation && cave.build(miningPost, miningPostLocation, miningPost.sprite)) {
            return {
                queenLocation,
                miningPostLocation
            }
        }

        cave.removeBuilding(queen, 'initialPlacementRetry')
    }

    throw new Error('Failed to place the initial queen and starter mining post.')
}

async function setup()
{
    const viewport = getViewportSize()

    // Intialize the application.
    await app.init({
        background: '#000000',
        width: viewport.width,
        height: viewport.height
    });

    // Then adding the application's canvas to the DOM body.
    applyCanvasViewportStyles(app.canvas, viewport)
    const appRoot = document.getElementById('app') ?? document.body
    appRoot.appendChild(app.canvas);
}

async function preload()
{
    const base = import.meta.env.BASE_URL;

    // Create an array of asset data to load.
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
        { alias: 'Enemy', src: `${base}assets/Enemy.png` },

        { alias: 'Scaffold', src: `${base}assets/Scaffold.png` },
        { alias: 'Queen', src: `${base}assets/Queen.png` },
        { alias: 'Algae Farm', src: `${base}assets/AlgaeFarm.png` },
        { alias: 'Storage', src: `${base}assets/Storage.png` },
        { alias: 'Smith', src: `${base}assets/Smith.png` },
        { alias: 'Mining Post', src: `${base}assets/MiningPost.png`},
        { alias: 'Radar', src: `${base}assets/Radar.png` },
        { alias: 'Barracks', src: `${base}assets/Barracks.png` },
        
        { alias: 'path', src: `${base}assets/Path.png` },
        { alias: 'orepath', src: `${base}assets/OrePath.png` },
        { alias: 'selected', src: `${base}assets/Selected.png` },
        { alias: 'selectededge', src: `${base}assets/SelectedEdge.png` },

        { alias: 'menu', src: `${base}assets/MenuBlock.png` },
        { alias: 'window_5x4', src: `${base}assets/window_5x4.png` },
        { alias: 'window_4x1', src: `${base}assets/window_4x1.png` },
        { alias: 'window_3x1', src: `${base}assets/window_3x1.png` },
        { alias: 'back', src: `${base}assets/BackArrow.png` }
        
    ];

    // Load the assets defined above.
    await PIXI.Assets.load(assets);
}

(async () =>
{
    await setup();
    await preload();

    const game = new Game(app)
    const heldPanKeys = new Set()
    const keyboardPanSpeedPx = 800
    const panKeyMap = new Map([
        ['KeyW', { x: 0, y: 1 }],
        ['KeyA', { x: 1, y: 0 }],
        ['KeyS', { x: 0, y: -1 }],
        ['KeyD', { x: -1, y: 0 }]
    ])

    //setting up game state

    const cave = new Cave(app,game);
    let tickCount = 0
    let debugEnemyCount = 1

    const spawnDebugEnemy = () => {
        const spawnTile = getRandomReachableSpawnTile(cave)
        if (!spawnTile) {
            console.log('No reachable passable tile is available for debug enemy spawn.')
            return false
        }

        const spawnLocation = toCoords(spawnTile.key)
        const enemy = new Enemy(`Debug Enemy ${debugEnemyCount}`, spawnLocation, game, PIXI.Sprite.from('Enemy'))
        if (!cave.spawn(enemy, spawnTile)) {
            console.log(`Failed to spawn debug enemy at ${spawnTile.key}.`)
            return false
        }

        debugEnemyCount++
        console.log(`Spawned ${enemy.name} at ${spawnTile.key}.`)
        return true
    }

    const runTick = () => {
        // game.cleanActive()
        tickCount++
        const tickStart = performance.now()

        if (game.danger) {
            cave.refreshBfsField('enemy')
        }
        for (let creature of cave.trilobites) {
            creature.move()
        }

        if (game.danger) {
            cave.refreshBfsField('colony')
            for (let creature of cave.enemies) {
                creature.move()
            }
        }

        for (const building of cave.buildings) {
            if (typeof building.tick === 'function') {
                building.tick(cave)
            }
        }

        if (tickCount % 20 === 0) {
            logStatsSnapshot(game, tickCount)
        }

        // logTickState(cave, tickCount)
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
    
    const initialColony = buildInitialColony(cave, game)
    const spawnX = initialColony.queenLocation.x
    const spawnY = initialColony.queenLocation.y

    let trilo = new Trilobite('Jeffery',{x:spawnX+2,y:spawnY},game)
    cave.spawn(trilo,cave.getTile((spawnX+2)+','+spawnY))

    trilo = new Trilobite('Quinton',{x:spawnX+2,y:spawnY+2},game)
    cave.spawn(trilo,cave.getTile((spawnX+2)+','+(spawnY+2)))

    trilo = new Trilobite('Yeetmuncher',{x:spawnX,y:spawnY},game)
    cave.spawn(trilo,cave.getTile(spawnX+','+spawnY))

    trilo = new Trilobite('Sigma',{x:spawnX,y:spawnY+2},game)
    cave.spawn(trilo,cave.getTile(spawnX+','+(spawnY+2)))

    cave.revealCave()

    game.totalXDelt = spawnX * 80 + 80
    game.totalYDelt = spawnY * 80 + 80

    for (let child of game.tileContainer.children) {
        child.baseX = child.baseX - game.totalXDelt
        child.baseY = child.baseY - game.totalYDelt
        child.x = child.position.x - game.totalXDelt
        child.y = child.position.y - game.totalYDelt
    }

    app.ticker.add((ticker) => {
        if (heldPanKeys.size === 0 || game.dragStartPos !== null) {
            return
        }

        const distance = keyboardPanSpeedPx * (ticker.deltaMS / 1000)
        let dx = 0
        let dy = 0

        for (const keyCode of heldPanKeys) {
            const direction = panKeyMap.get(keyCode)
            if (!direction) {
                continue
            }

            dx += direction.x * distance
            dy += direction.y * distance
        }

        game.panWorldByScreenDelta(dx, dy)
    })

    //event listeners relative to full game

    const resizeViewport = () => {
        const viewport = getViewportSize()
        app.renderer.resize(viewport.width, viewport.height)
        applyCanvasViewportStyles(app.canvas, viewport)
        game.handleViewportResize(viewport.width, viewport.height)
    }

    const handleWheel = (event) => {
        if (game.menu?.handleWheel?.(event)) {
            event.preventDefault()
            return
        }

        if (game.dragging) {
            event.preventDefault()
            return
        }
        if (event.deltaY < 0) {
            if (game.currentScale < 2.5) {
                game.currentScale = game.currentScale * (4 / 3)
            } else {
                return
            }
        } else {
            if (game.currentScale > 0.1) {
                game.currentScale = game.currentScale * 0.75
            } else {
                return
            }
        }
        game.syncWorldSpriteTransforms(0, 0, { skipFloatingBuildingOffset: true })
        event.preventDefault()
    }

    app.canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('resize', resizeViewport)

    window.addEventListener('mousedown', (e) => {
        const rect = app.canvas.getBoundingClientRect();
        game.dragStartPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        game.dragging = false;
    });

    window.addEventListener('mousemove', (e) => {

        let rect = app.canvas.getBoundingClientRect();
        let pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        if (game.dragStartPos !== null) {

            let dx = pos.x - game.dragStartPos.x;
            let dy = pos.y - game.dragStartPos.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
                game.dragging = true;
                game.previewWorldPan(dx, dy)
            }

        }
        if (game.buildMode) {
            game.updateFloatingBuildingPosition(pos)
        }
    });

    window.addEventListener('mouseup', (e) => {
        let rect = app.canvas.getBoundingClientRect();
        let pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        if (game.dragging) {
            let dx = pos.x - game.dragStartPos.x;
            let dy = pos.y - game.dragStartPos.y;

            game.panWorldByScreenDelta(dx, dy, { skipFloatingBuildingOffset: true })
        } else {
           //other functionality
        }
        game.dragStartPos = null;
        game.dragging = false;
    });

    window.addEventListener('keydown', (e) => {
        if (panKeyMap.has(e.code)) {
            heldPanKeys.add(e.code)
            e.preventDefault()
            return
        }

        if (e.key ==='Enter') {
            runTick()
            game.refreshBfsFieldDebug(cave)
        } else if (e.code === 'Space') {
            e.preventDefault()
            if (e.repeat) {
                return
            }
            game.cleanActive()
            gamePaused = !gamePaused
        } else if (e.key === '1') {
            if (gamePaused) {
                game.showBfsFieldDebug(cave, 'queen')
            } else {
                tickSpeedMs = 500
            }
        } else if (e.key === '2') {
            if (gamePaused) {
                game.showBfsFieldDebug(cave, 'enemy')
            } else {
                tickSpeedMs = 250
            }
        } else if (e.key === '3') {
            if (gamePaused) {
                game.showBfsFieldDebug(cave, 'colony')
            } else {
                tickSpeedMs = 100
            }
        } else if (e.key === '4') {
            if (!gamePaused) {
                tickSpeedMs = 50
            }
        } else if (e.key === 'p' || e.key === 'P') {
            spawnDebugEnemy()
            game.refreshBfsFieldDebug(cave)
            logTickState(cave, tickCount)
        } else if (e.key ==='Escape') {
            game.cleanActive({ closeMenu: true })
        } else if (e.key === 'r') {
            if (game.buildMode) {
                game.rotateFloatingBuilding()
            }
        }
    })

    window.addEventListener('keyup', (e) => {
        if (panKeyMap.has(e.code)) {
            heldPanKeys.delete(e.code)
        }
    })

    window.addEventListener('blur', () => {
        heldPanKeys.clear()
    })


})();

