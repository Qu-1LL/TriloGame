
import * as PIXI from 'pixi.js'
import { Cave, toCoords } from './cave.js'
import * as BUILD from './building.js' 
import { Creature } from './creature.js'
import { Trilobite } from './trilobite.js'
import { Game } from './game.js'

const app = new PIXI.Application();
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

async function setup()
{
    // Intialize the application.
    await app.init({ background: '#000000', height: window.innerHeight-5, width: window.innerWidth });

    // Then adding the application's canvas to the DOM body.
    document.body.appendChild(app.canvas);
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

        { alias: 'Scaffold', src: `${base}assets/Scaffold.png` },
        { alias: 'Queen', src: `${base}assets/Queen.png` },
        { alias: 'Algae Farm', src: `${base}assets/AlgaeFarm.png` },
        { alias: 'Storage', src: `${base}assets/Storage.png` },
        { alias: 'Smith', src: `${base}assets/Smith.png` },
        { alias: 'Mining Post', src: `${base}assets/MiningPost.png`},

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

    //setting up game state

    const cave = new Cave(app,game);
    let tickCount = 0

    const runTick = () => {
        // game.cleanActive()
        tickCount++
        const tickStart = performance.now()

        for (let creature of cave.creatures) {
            creature.move()
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
    
    var queen = new BUILD.Queen()
    var spawnX = Math.floor((Math.random() * 20) - 10)
    var spawnY = Math.floor((Math.random() * 20) - 10)

    while(!cave.build(queen,{x:spawnX,y:spawnY},queen.sprite)) {
        spawnX = Math.floor((Math.random() * 20) - 10)
        spawnY = Math.floor((Math.random() * 20) - 10)
    }

    let trilo = new Trilobite('Jeffery',{x:spawnX+2,y:spawnY},game)
    cave.spawn(trilo,cave.getTile((spawnX+2)+','+spawnY))

    trilo = new Trilobite('Quinton',{x:spawnX+2,y:spawnY+2},game)
    cave.spawn(trilo,cave.getTile((spawnX+2)+','+(spawnY+2)))

    trilo = new Trilobite('Yeetmuncher',{x:spawnX,y:spawnY},game)
    cave.spawn(trilo,cave.getTile(spawnX+','+spawnY))

    trilo = new Trilobite('Sigma',{x:spawnX,y:spawnY+2},game)
    cave.spawn(trilo,cave.getTile(spawnX+','+(spawnY+2)))

    game.totalXDelt = spawnX * 80 + 80
    game.totalYDelt = spawnY * 80 + 80

    for (let child of game.tileContainer.children) {
        child.baseX = child.baseX - game.totalXDelt
        child.baseY = child.baseY - game.totalYDelt
        child.x = child.position.x - game.totalXDelt
        child.y = child.position.y - game.totalYDelt
    }

    //event listeners relative to full game

    window.addEventListener("wheel", (event) => {
        if (game.dragging) {
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
        for (let child of game.tileContainer.children) {
            child.scale.set(game.currentScale);
            if (child === game.floatingBuilding.sprite) {
                continue
            }
            child.x = game.midx + ((child.baseX - game.midx) * game.currentScale)
            child.y = game.midy + ((child.baseY - game.midy) * game.currentScale)
        }
    })

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
                for (let child of game.tileContainer.children) {
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
            // console.log(game.floatingBuilding.sprite.position.x+","+game.floatingBuilding.sprite.position.y)
        }
    });

    window.addEventListener('mouseup', (e) => {
        let rect = app.canvas.getBoundingClientRect();
        let pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        if (game.dragging) {
            let dx = (pos.x - game.dragStartPos.x) * (1 / game.currentScale);
            let dy = (pos.y - game.dragStartPos.y) * (1 / game.currentScale);

            game.totalXDelt -= dx
            game.totalYDelt -= dy
            
            for (let child of game.tileContainer.children) {
                child.baseX = child.baseX + dx
                child.baseY = child.baseY + dy
            }
        } else {
           //other functionality
        }
        game.dragStartPos = null;
        game.dragging = false;
    });

    window.addEventListener('keydown', (e) => {
        if (e.key ==='Enter') {
            // console.log('Enter pressed')
            runTick()
        } else if (e.code === 'Space') {
            e.preventDefault()
            if (e.repeat) {
                return
            }
            gamePaused = !gamePaused
            // console.log(`Auto-tick ${gamePaused ? 'paused' : 'running'} (${tickSpeedMs}ms)`)
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
        } else if (e.key ==='Escape') {
            game.cleanActive()
        } else if (e.key === 'r') {
            if (game.buildMode) {
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
        }
    })


})();

