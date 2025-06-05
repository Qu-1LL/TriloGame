
import * as PIXI from 'pixi.js'
import { Cave, toCoords } from './cave.js'
import { Building } from './building.js'
import { Creature } from './creature.js'
import { Game } from './game.js'

const app = new PIXI.Application();

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
        { alias: 'Queen', src: `${base}assets/Queen.png` },
        { alias: 'path', src: `${base}assets/Path.png` },
        { alias: 'orepath', src: `${base}assets/OrePath.png` },
        { alias: 'selected', src: `${base}assets/Selected.png` },
        { alias: 'menu', src: `${base}assets/MenuBlock.png` },
        {alias: 'window_5x4', src: `${base}assets/window_5x4.png` }
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
    
    let queen = new Building('Queen',{x:3,y:3},[[1,1,1],[1,0,1],[1,1,1]])
    cave.build(queen,{x:-1,y:-1},PIXI.Sprite.from('Queen'))

    let trilo = new Creature('Jeffery',{x:1,y:-1},PIXI.Sprite.from('Trilobite'),game)
    cave.spawn(trilo)

    trilo = new Creature('Quinton',{x:1,y:1},PIXI.Sprite.from('Trilobite'),game)
    cave.spawn(trilo)

    trilo = new Creature('Yeetmuncher',{x:-1,y:-1},PIXI.Sprite.from('Trilobite'),game)
    cave.spawn(trilo)

    trilo = new Creature('Sigma',{x:-1,y:1},PIXI.Sprite.from('Trilobite'),game)
    cave.spawn(trilo)

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
            if (game.currentScale > 0.07) {
                game.currentScale = game.currentScale * 0.75
            } else {
                return
            }
        }
        for (let child of game.tileContainer.children) {
            child.scale.set(game.currentScale);
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

        if (game.dragStartPos !== null) {
            const rect = app.canvas.getBoundingClientRect();
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            const dx = pos.x - game.dragStartPos.x;
            const dy = pos.y - game.dragStartPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
                game.dragging = true;
                for (let child of game.tileContainer.children) {
                    child.x = game.midx + ((child.baseX - game.midx) * game.currentScale) + dx
                    child.y = game.midy + ((child.baseY - game.midy) * game.currentScale) + dy
                }
            }

        }
    });

    window.addEventListener('mouseup', (e) => {
        if (game.dragging) {
            let rect = app.canvas.getBoundingClientRect();
            let pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            let dx = pos.x - game.dragStartPos.x;
            let dy = pos.y - game.dragStartPos.y;

            game.totalXDelt += dx
            game.totalYDelt += dy
            
            for (let child of game.tileContainer.children) {
                child.baseX = child.baseX + (dx * (1/game.currentScale))
                child.baseY = child.baseY + (dy * (1/game.currentScale))
            }
        } else {
            //a bunch of other onclick functionality
        }
        game.dragStartPos = null;
        game.dragging = false;
    });

    window.addEventListener('keydown', (e) => {
        if (e.key ==='Enter') {
            console.log('Enter pressed')
            for(let creature of cave.creatures) {
                creature.move()
            }
        } else if (e.key ==='Escape') {
            game.cleanActive()
        }
    })


})();

