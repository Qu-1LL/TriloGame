
import { Assets, Application, Sprite, Texture, Container } from 'pixi.js'
import { Cave, toCoords } from './map.js'

const app = new Application();

async function setup()
{
    // Intialize the application.
    await app.init({ background: '#000000', height: window.innerHeight-21, width: window.innerWidth-16 });

    // Then adding the application's canvas to the DOM body.
    document.body.appendChild(app.canvas);
}

async function preload()
{
    // Create an array of asset data to load.
    const assets = [
        { alias: 'empty', src: '/EmptyTile.png' },
        { alias: 'wall', src: '/CaveWall.png'},
        { alias: 'Sandstone', src: '/SandTile.png'},
        { alias: 'Malachite', src: '/MalachiteTile.png'},
        { alias: 'Magnetite', src: '/MagnetiteTile.png'},
        { alias: 'Perotene', src: '/PeroteneTile.png'},
        { alias: 'Ilmenite', src: '/IlmeniteTile.png'},
        { alias: 'Cochinium', src: '/CochiniumTile.png'}
    ];

    // Load the assets defined above.
    await Assets.load(assets);
}

(async () =>
{
    await setup();
    await preload();

    const cave = new Cave();

    let midx = app.screen.width / 2
    let midy = app.screen.height / 2

    let allCoords = cave.getCoords()

    const tileContainer = new Container();


    for (let i = 0; i < allCoords.length; i++) {
        let myAsset = cave.getTile(allCoords[i]).getBase()
        let myTile = Sprite.from(myAsset)
        myTile.anchor.set(0)
        let myCoords = toCoords(allCoords[i])

        myTile.x = midx + (myCoords.x * 80)
        myTile.y = midy + (myCoords.y * 80)
        myTile.baseX = myTile.position.x
        myTile.baseY = myTile.position.y

        tileContainer.addChild(myTile)

        myTile.interactive = true;
    }

    app.stage.addChild(tileContainer)

    let currentScale = 1

    let dragging = false;
    let dragStartPos = null;

    window.addEventListener("wheel", (event) => {
        if (dragging) {
            return
        }
        if (event.deltaY > 0) {
            if (currentScale < 2.5) {
                currentScale = currentScale * (4 / 3)
            } else {
                return
            }
        } else {
            if (currentScale > 0.07) {
                currentScale = currentScale * 0.75
            } else {
                return
            }
        }
        for (let child of tileContainer.children) {
            child.scale.set(currentScale);
            child.x = midx + ((child.baseX - midx) * currentScale)
            child.y = midy + ((child.baseY - midy) * currentScale)
        }
    })


    window.addEventListener('mousedown', (e) => {
        const rect = app.canvas.getBoundingClientRect();
        dragStartPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        dragging = false;
    });

    window.addEventListener('mousemove', (e) => {

        if (dragStartPos) {
            const rect = app.canvas.getBoundingClientRect();
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            const dx = pos.x - dragStartPos.x;
            const dy = pos.y - dragStartPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                dragging = true;
                for (let child of tileContainer.children) {
                    child.x = midx + ((child.baseX - midx) * currentScale) + dx
                    child.y = midy + ((child.baseY - midy) * currentScale) + dy
                }
            }

        }
    });

    window.addEventListener('mouseup', (e) => {
        if (dragging) {
            const rect = app.canvas.getBoundingClientRect();
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            const dx = pos.x - dragStartPos.x;
            const dy = pos.y - dragStartPos.y;
            
            for (let child of tileContainer.children) {
                child.baseX = child.baseX + (dx * (1/currentScale))
                child.baseY = child.baseY + (dy * (1/currentScale))
            }
        } else {
            //a bunch of other onclick functionality
        }
        dragStartPos = null;
        dragging = false;
    });


})();