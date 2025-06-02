
import * as PIXI from 'pixi.js'
import { Cave, toCoords } from './cave.js'
import { Building } from './building.js'
import { Creature } from './creature.js'

const app = new PIXI.Application();

async function setup()
{
    // Intialize the application.
    await app.init({ background: '#000000', height: window.innerHeight-21, width: window.innerWidth-16 });

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
        { alias: 'selected', src: `${base}assets/Selected.png` }
    ];

    // Load the assets defined above.
    await PIXI.Assets.load(assets);
}

(async () =>
{
    await setup();
    await preload();
    
    //"global" variables

    let currentScale = 1

    let dragging = false;
    let dragStartPos = null;

    let totalXDelt = 0
    let totalYDelt = 0
    
    //setting up stage
    
    const tileContainer = new PIXI.Container();
    tileContainer.sortableChildren = true
    app.stage.addChild(tileContainer)

    let midx = app.screen.width / 2
    let midy = app.screen.height / 2

    var selectedCreature = new class {
        constructor() {
            this.creature = null
            this.selection = PIXI.Sprite.from('selected')
            this.selection.x = 0
            this.selection.y = 0
            this.selection.baseX = 0
            this.selection.baseY = 0
            this.selection.visible = false
            this.selection.anchor.set(0.5)
            this.selection.zIndex = 10
            tileContainer.addChild(this.selection)
        }

        setCreature(c) {
            this.creature = c
            if (c == null) {
                this.selection.visible = false
            } else {
                this.selection.x = c.sprite.position.x
                this.selection.y = c.sprite.position.y
                this.selection.baseX = c.sprite.baseX
                this.selection.baseY = c.sprite.baseY
                this.selection.visible = true
            }
        }
    }

    //functions called by main

    function whenWallMined (interactionEvent, myTile, cave, tileContainer, emptyCoords)  {

        if (dragging) {
            return
        }

        myTile.on("mouseup", () => {
            return
        })

        myTile.texture = Texture.from('empty')
        let newEmpty = cave.getTile(emptyCoords)
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
            wallTile.setBase('wall')

            let newDelts = new Map();
            newDelts.set('n',{x:0,y:-1})
            newDelts.set('s',{x:0,y:1})
            newDelts.set('e',{x:1,y:0})
            newDelts.set('w',{x:-1,y:0})

            let wallCoords = toCoords(newCoords)
            for (let d of newDelts.values()) {
                let newN = cave.getTile((wallCoords.x + d.x) + "," + (wallCoords.y + d.y))
                
                if (newN != undefined) {
                    wallTile.addNeighbor(newN)
                    newN.addNeighbor(wallTile)
                }
            }

            let newTile = Sprite.from('wall')
            newTile.x = interactionEvent.currentTarget.x + (dir.x * 80 * currentScale)
            newTile.y = interactionEvent.currentTarget.y + (dir.y * 80 * currentScale)
            newTile.baseX = interactionEvent.currentTarget.baseX + (dir.x * 80)
            newTile.baseY = interactionEvent.currentTarget.baseY + (dir.y * 80)

            newTile.anchor.set(0.5)
            newTile.interactive = true;
            newTile.buttonMode = true;

            newTile.scale.set(currentScale)

            tileContainer.addChild(newTile)

            newTile.on("mouseup", (interactionEvent) => {
                whenWallMined(interactionEvent, newTile, cave, tileContainer,newCoords)
            })
        }
    }

    function emptyTileClicked(coords,myCave) {
        for (let sprite of floatingPaths) {
                sprite.parent.removeChild(sprite);
                sprite.destroy()
            }
        floatingPaths.clear()

        if (!dragging && selectedCreature.creature && cave.getTile(coords).creatureCanFit) {

            let path = myCave.bfsPath((selectedCreature.creature.location.x+","+selectedCreature.creature.location.y),coords)
            if(!path) {
                selectedCreature.setCreature(null)
                return
            } 
            path.shift()
            selectedCreature.creature.queue.clear()
            for (let i = 0; i< path.length;i++) {
                selectedCreature.creature.queue.enqueue(toCoords(path[i]))
            }
        }

        selectedCreature.setCreature(null)
    }

    let floatingPaths = new Set()

    function emptyTileHover(coords,myCave) {
        //something in here breaks the code

        if (!dragging && selectedCreature.creature !== null) {
            for (let sprite of floatingPaths) {
                sprite.parent.removeChild(sprite);
                sprite.destroy()
            }
            floatingPaths.clear()


            let path = myCave.bfsPath((selectedCreature.creature.location.x+","+selectedCreature.creature.location.y),coords)
            let myCoords = toCoords(path.shift())
            let myDX = 0
            let myDY = 0
            while(path.length > 0) {
                let nextCoords = toCoords(path[0])
                let dx = myCoords.x - nextCoords.x
                let dy = myCoords.y - nextCoords.y
                myDX -= dx
                myDY -= dy
                let nextSprite = PIXI.Sprite.from('path')
                nextSprite.x = selectedCreature.creature.sprite.x + (myDX * 80 * currentScale)
                nextSprite.y = selectedCreature.creature.sprite.y + (myDY * 80 * currentScale)
                nextSprite.baseX = selectedCreature.creature.sprite.x + (myDX * 80)
                nextSprite.baseY = selectedCreature.creature.sprite.y + (myDY * 80)

                if (dx > 0) {
                    nextSprite.x = nextSprite.position.x + (40 * currentScale)
                    nextSprite.basex += 40
                } else if (dx < 0) {
                    nextSprite.x = nextSprite.position.x - (40 * currentScale)
                    nextSprite.baseX -= 40
                }
                if (dy > 0) {
                    nextSprite.y = nextSprite.position.y + (40 * currentScale)
                    nextSprite.baseY += 40
                } else if (dy < 0) {
                    nextSprite.y = nextSprite.position.y - (40 * currentScale)
                    nextSprite.baseY -= 40
                }

                nextSprite.scale.set(currentScale)
                nextSprite.zIndex = 2
                nextSprite.anchor.set(0.5)

                if (dy !== 0) {
                    nextSprite.rotation = Math.PI / 2
                }

                tileContainer.addChild(nextSprite)
                floatingPaths.add(nextSprite)

                myCoords = toCoords(path.shift())
            }
        }
    }

    function emptyTileHoverExit() {
        if (!dragging && selectedCreature.creature) {
            for (let sprite of floatingPaths) {
                sprite.parent.removeChild(sprite);
                sprite.destroy()
            }
            floatingPaths.clear()
        }
    }

    //setting up game state

    const cave = new Cave(tileContainer,app,whenWallMined,emptyTileClicked,emptyTileHover,emptyTileHoverExit);
    
    let queen = new Building('Queen',{x:3,y:3},[[1,1,1],[1,0,1],[1,1,1]])
    cave.build(queen,{x:-1,y:-1},PIXI.Sprite.from('Queen'),currentScale)

    let trilo = new Creature('Jeffery',{x:1,y:-1},PIXI.Sprite.from('Trilobite'),selectedCreature)
    cave.spawn(trilo,currentScale)

    trilo = new Creature('Quinton',{x:1,y:1},PIXI.Sprite.from('Trilobite'),selectedCreature)
    cave.spawn(trilo,currentScale)

    trilo = new Creature('Yeetmuncher',{x:-1,y:-1},PIXI.Sprite.from('Trilobite'),selectedCreature)
    cave.spawn(trilo,currentScale)

    trilo = new Creature('Sigma',{x:-1,y:1},PIXI.Sprite.from('Trilobite'),selectedCreature)
    cave.spawn(trilo,currentScale)

    //event listeners relative to full game

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
            let rect = app.canvas.getBoundingClientRect();
            let pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            let dx = pos.x - dragStartPos.x;
            let dy = pos.y - dragStartPos.y;

            totalXDelt += dx
            totalYDelt += dy
            
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

    window.addEventListener('keydown', (e) => {
        if (e.key ==='Enter') {
            console.log('Enter pressed')
            for(let creature of cave.creatures) {
                creature.move(currentScale,midx,midy)
            }
        }
    })


})();

