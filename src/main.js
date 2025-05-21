
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
        { alias: 'Algae', src: '/AlgaeTile.png'},
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

    let currentScale = 1

    function whenWallMined (interactionEvent, myTile, cave, tileContainer, emptyCoords)  {

        myTile.on("mouseup", () => {
            return
        })


        myTile.texture = Texture.from('empty')
        let newEmpty = cave.getTile(emptyCoords)
        console.log("tile clicked: ")
        console.log(emptyCoords)
        console.log(newEmpty)
        newEmpty.setBase('empty')

        
                
        let myDelts = new Map();
        myDelts.set('n',{x:0,y:-1})
        myDelts.set('s',{x:0,y:1})
        myDelts.set('e',{x:1,y:0})
        myDelts.set('w',{x:-1,y:0})
        let myCoords = toCoords(emptyCoords)
        for (let n of cave.getTile(emptyCoords).getNeighbors()) {
            let nCoords = toCoords(n.value)
            if (nCoords.x - myCoords.x == 1 ) {
                myDelts.delete('e')
            } else if (nCoords.x - myCoords.x == -1) {
                myDelts.delete('w')
            } else if (nCoords.y - myCoords.y == -1) {
                myDelts.delete('n')
            } else {
                myDelts.delete('s')
            }
        }
        for (let dir of myDelts.values()) {
            let newCoords = (myCoords.x + dir.x) + "," + (myCoords.y + dir.y)
            let wallTile = cave.addTile(newCoords)
            console.log("tile added: ")
            console.log(wallTile)
            wallTile.setBase('wall')

            let newDelts = new Map();
            newDelts.set('n',{x:0,y:-1})
            newDelts.set('s',{x:0,y:1})
            newDelts.set('e',{x:1,y:0})
            newDelts.set('w',{x:-1,y:0})

            let wallCoords = toCoords(newCoords)
            console.log("new wall: ")
            console.log(wallCoords)
            for (let d of newDelts.values()) {
                let newN = cave.getTile((wallCoords.x + d.x) + "," + (wallCoords.y + d.y))
                
                if (newN != undefined) {
                    console.log("new neighbor: ")
                    console.log(newN)
                    wallTile.addNeighbor(newN)
                    newN.addNeighbor(wallTile)
                }
            }

            let newTile = Sprite.from('wall')
            newTile.x = interactionEvent.currentTarget.x + (dir.x * 80 * currentScale)
            newTile.y = interactionEvent.currentTarget.y + (dir.y * 80 * currentScale)
            newTile.baseX = interactionEvent.currentTarget.baseX + (dir.x * 80)
            newTile.baseY = interactionEvent.currentTarget.baseY + (dir.y * 80)

            newTile.anchor.set(0)
            newTile.interactive = true;
            newTile.buttonMode = true;

            newTile.scale.set(currentScale)

            tileContainer.addChild(newTile)

            newTile.on("pointertap", (interactionEvent) => {
                    whenWallMined(interactionEvent, newTile, cave, tileContainer,newCoords)
                })
        }
    }

    const cave = new Cave();

    let midx = app.screen.width / 2
    let midy = app.screen.height / 2

    let allCoords = cave.getCoords()

    const tileContainer = new Container();


    for (let i = 0; i < allCoords.length; i++) {
        let myAsset = cave.getTile(allCoords[i]).getBase()
        let myTile = Sprite.from(myAsset)

        if (myAsset == 'wall') {
            myTile.on("mouseup", (interactionEvent) => {
                if (!dragging) {
                    whenWallMined(interactionEvent, myTile, cave, tileContainer,allCoords[i])
                }
            })
        }

        myTile.anchor.set(0)
        let myCoords = toCoords(allCoords[i])

        myTile.x = midx + (myCoords.x * 80)
        myTile.y = midy + (myCoords.y * 80)
        myTile.baseX = myTile.position.x
        myTile.baseY = myTile.position.y

        tileContainer.addChild(myTile)

        myTile.interactive = true;
        myTile.buttonMode = true;
    }

    app.stage.addChild(tileContainer)

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

            if (dist > 10) {
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

