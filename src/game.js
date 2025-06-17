import * as PIXI from 'pixi.js'
import { toCoords } from './cave.js'
import { Menu } from './menu.js'
import { Ore } from './ores.js'
import { Creature } from './creature.js'
import * as BUILD from './building.js'

export class Game {

    constructor(app) {
        this.app = app
        this.currentScale = 1

        //event variables

        this.dragging = false;
        this.dragStartPos = null;
        this.movePath = false
        this.buildMode = false

        this.totalXDelt = 0
        this.totalYDelt = 0
        
        //setting up stage
        //UI variables
        
        this.tileContainer = new PIXI.Container();
        this.tileContainer.sortableChildren = true
        app.stage.addChild(this.tileContainer)

        this.uiContainer = new PIXI.Container();
        this.uiContainer.sortableChildren = true
        app.stage.addChild(this.uiContainer)

        this.midx = app.screen.width / 2
        this.midy = app.screen.height / 2

        this.floatingPaths = new Set()

        this.floatingBuilding = {
            building: null,
            sprite: null,
            rotation: 0
        }

        //practical variables

        this.resources = {
            algae: 0,
            sandstone: 0,
            malachite: 0,
            magnetite: 0,
            perotene: 0,
            ilmenite: 0,
            cochinium: 0
        } 

        this.unlockedBuildings = [
            new BUILD.Factory(BUILD.AlgaeFarm,this),
            new BUILD.Factory(BUILD.Storage,this),
            new BUILD.Factory(BUILD.Smith,this)
        ]


        this.selected = new class {
            constructor(tileContainer,uiContainer,game) {
                this.object = null
                this.selection = PIXI.Sprite.from('selected')
                this.selection.x = 0
                this.selection.y = 0
                this.selection.baseX = 0
                this.selection.baseY = 0
                this.selection.visible = false
                this.selection.anchor.set(0.5)
                this.selection.zIndex = 3

                this.claySelection = new Set()

                this.uiContainer = uiContainer
                this.tileContainer = tileContainer
                tileContainer.addChild(this.selection)
                this.menu = null
                this.game = game
                this.selectedPaths = new Set()
            }
            setSelected(s) {
                
                if (s == null) {
                    this.object = s
                    return
                } else {
                    this.game.cleanActive()
                    this.object = s

                    this.menu = new Menu(app,s,this.uiContainer)
                    this.menu.open()

                    this.centerSelection()

                    if (this.object instanceof Creature) {
                        this.selection.x = s.sprite.position.x
                        this.selection.y = s.sprite.position.y
                        this.selection.baseX = s.sprite.baseX
                        this.selection.baseY = s.sprite.baseY
                        this.selection.visible = true
                        if (this.object.queue.peek()) {
                            let myPath = [...this.object.queue.toArray()]
                            myPath.unshift(this.object.location)
                            this.game.displayPath(myPath,this.selectedPaths)
                        }
                    } else if (this.object instanceof BUILD.Building) {
                        for (let tile of this.object.tileArray) {
                            for (let n of tile.getNeighbors()) {
                                if (!this.object.tileArray.includes(n)) {
                                    let myBorder = PIXI.Sprite.from('selectededge')
                                    myBorder.anchor.set(0.5, 0)
                                    this.claySelection.add(myBorder)
                                    this.tileContainer.addChild(myBorder)

                                    let nCoords = toCoords(n.value)
                                    let tileCoords = toCoords(tile.value)
                                    let dx = nCoords.x - tileCoords.x
                                    let dy = nCoords.y - tileCoords.y

                                    if (dy == 0) {
                                        myBorder.rotation = Math.PI / 2
                                    }

                                    if (dy < 0 || dx < 0) {
                                        myBorder.anchor.set(0.5,1)
                                    }

                                    myBorder.x = tile.sprite.position.x + (dx * 40 * this.game.currentScale)
                                    myBorder.y = tile.sprite.position.y + (dy * 40 * this.game.currentScale)
                                    myBorder.baseX = tile.sprite.baseX + (dx * 40)
                                    myBorder.baseY = tile.sprite.baseY + (dy * 40)
                                    myBorder.scale.set(this.game.currentScale)
                                    myBorder.visible = true
                                    myBorder.zIndex = 3
                                    
                                }
                            }
                        }
                    }
                }
            }
            centerSelection() {
                let menuOffset = this.menu.block.width / 2

                let dx = (this.object.location.x * 80) - (this.game.totalXDelt - (menuOffset * (1 / this.game.currentScale)))
                let dy = (this.object.location.y * 80) - this.game.totalYDelt
                this.game.totalXDelt += dx
                this.game.totalYDelt += dy
                for (let child of this.tileContainer.children) {
                    child.baseX = child.baseX - dx
                    child.baseY = child.baseY - dy
                    child.x = child.position.x - (dx * this.game.currentScale)
                    child.y = child.position.y - (dy * this.game.currentScale)
                }
            }
        }(this.tileContainer,this.uiContainer,this)
    }

    cleanActive() {

        for (let sprite of this.floatingPaths) {
            sprite.parent.removeChild(sprite);
            sprite.destroy()
        }
        for (let sprite of this.selected.claySelection) {
            sprite.parent.removeChild(sprite);
            sprite.destroy()
        }
        this.floatingPaths.clear()
        this.selected.claySelection.clear()
        this.movePath = false
        this.buildMode = false
        this.floatingBuilding.building = null
        this.tileContainer.removeChild(this.floatingBuilding.sprite)
        this.floatingBuilding.sprite = null
        this.floatingBuilding.rotation = 0

        if (this.selected.menu !== null) {
            this.selected.menu.close()
            this.selected.menu = null

        }
        this.selected.selection.visible = false
        for (let sprite of this.selected.selectedPaths) {
            sprite.parent.removeChild(sprite)
            sprite.destroy()
        }
        this.selected.selectedPaths.clear()
        this.selected.setSelected(null)
        
    }

    whenWallMined (interactionEvent, myTile, cave, emptyCoords)  {

        if (this.dragging || this.buildMode || cave.getTile(emptyCoords).getBase() != 'wall') {
            return
        }

        myTile.texture = PIXI.Texture.from('empty')
        let newEmpty = cave.getTile(emptyCoords)
        newEmpty.setBase('empty')
        newEmpty.creatureCanFit = true

        myTile.on("mouseup", () => {
            this.emptyTileClicked(emptyCoords,cave)
        })
        myTile.on("pointerover", (event) => {
            this.emptyTileHover(emptyCoords,cave,event)
        })
        myTile.on("pointerout", () => {
            this.emptyTileHoverExit()
        })
  
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

        //for each empty neighbor
        //create new wall tile
        for (let dir of myDelts.values()) {
            let newCoords = (myCoords.x + dir.x) + "," + (myCoords.y + dir.y)
            let wallTile = cave.addTile(newCoords)
            wallTile.setBase('wall')
            wallTile.creatureCanFit = false

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
                }
            }

            let newTile = PIXI.Sprite.from('wall')
            wallTile.sprite = newTile
            newTile.x = interactionEvent.currentTarget.x + (dir.x * 80 * this.currentScale)
            newTile.y = interactionEvent.currentTarget.y + (dir.y * 80 * this.currentScale)
            newTile.baseX = interactionEvent.currentTarget.baseX + (dir.x * 80)
            newTile.baseY = interactionEvent.currentTarget.baseY + (dir.y * 80)

            newTile.anchor.set(0.5)
            newTile.interactive = true;
            newTile.buttonMode = true;

            newTile.scale.set(this.currentScale)

            this.tileContainer.addChild(newTile)

            newTile.on("mouseup", (interactionEvent) => {
                this.whenWallMined(interactionEvent, newTile, cave, newCoords)
            })
        }
    }

    emptyTileClicked(coords,myCave) {

        if (!this.dragging && !this.buildMode && this.movePath && myCave.getTile(coords).creatureFits()) {

            let path = myCave.bfsPath((this.selected.object.location.x+","+this.selected.object.location.y),coords)
            if(!path) {
                this.selected.setCreature(null)
                return
            } 
            path.shift()
            this.selected.object.queue.clear()
            for (let i = 0; i< path.length;i++) {
                this.selected.object.queue.enqueue(path[i])
            }
            this.selected.setSelected(null)
        }

        if (!this.dragging && !this.buildMode) {
            // for (let sprite of this.floatingPaths) {
            //     sprite.parent.removeChild(sprite);
            //     sprite.destroy()
            // }
            // this.floatingPaths.clear()
            // this.movePath = false
            // this.selected.setSelected(null)

            this.cleanActive()
        }

        if(this.buildMode && !this.dragging) {
            if(myCave.canBuild(this.floatingBuilding.building,toCoords(coords))) {
                this.floatingBuilding.sprite.parent.removeChild(this.floatingBuilding.sprite)
                myCave.build(this.floatingBuilding.building,toCoords(coords),this.floatingBuilding.sprite)
                this.floatingBuilding.sprite = null
                this.buildMode = false
                this.cleanActive()
            }
        }

    }

    emptyTileHover(coords,myCave,event) {

        let pos = event.data.global

        if (!this.dragging && 
            !this.buildMode &&
            this.movePath &&
            pos.x < (
                this.app.screen.width - this.selected.menu.block.width
            ) && (
                myCave.getTile(coords).creatureFits()
            )
        ) {
            for (let sprite of this.floatingPaths) {
                sprite.parent.removeChild(sprite)
                sprite.destroy()
            }
            this.floatingPaths.clear()

            // for (let ore in Ore.getOres()) {
            //     if (myCave.getTile(coords).getBase() === ore.name) {
            //         pathType = 'orepath'
            //         break
            //     }
            // }
            
            let path = myCave.bfsPath((this.selected.object.location.x+","+this.selected.object.location.y),coords)
            this.displayPath(path,this.floatingPaths)
        }
    }

    displayPath(path,pathSet) {
        let myCoords = path.shift()
        let myDX = 0
        let myDY = 0
        while(path.length > 0) {
            let nextCoords = path[0]
            let dx = myCoords.x - nextCoords.x
            let dy = myCoords.y - nextCoords.y
            myDX -= dx
            myDY -= dy
            let nextSprite = PIXI.Sprite.from('path')
            nextSprite.x = this.selected.object.sprite.x + (myDX * 80 * this.currentScale)
            nextSprite.y = this.selected.object.sprite.y + (myDY * 80 * this.currentScale)
            nextSprite.baseX = this.selected.object.sprite.baseX + (myDX * 80)
            nextSprite.baseY = this.selected.object.sprite.baseY + (myDY * 80)

            if (dx > 0) {
                nextSprite.x = nextSprite.position.x + (40 * this.currentScale)
                nextSprite.baseX += 40
            } else if (dx < 0) {
                nextSprite.x = nextSprite.position.x - (40 * this.currentScale)
                nextSprite.baseX -= 40
            }
            if (dy > 0) {
                nextSprite.y = nextSprite.position.y + (40 * this.currentScale)
                nextSprite.baseY += 40
            } else if (dy < 0) {
                nextSprite.y = nextSprite.position.y - (40 * this.currentScale)
                nextSprite.baseY -= 40
            }

            nextSprite.scale.set(this.currentScale)
            nextSprite.zIndex = 3
            nextSprite.anchor.set(0.5)

            if (dy !== 0) {
                nextSprite.rotation = Math.PI / 2
            }

            this.tileContainer.addChild(nextSprite)
            pathSet.add(nextSprite)

            myCoords = path.shift()
        }
    }

    emptyTileHoverExit() {
        if (!this.dragging && !this.buildMode && this.selected.object) {
            for (let sprite of this.floatingPaths) {
                sprite.parent.removeChild(sprite)
                sprite.destroy()
            }
            this.floatingPaths.clear()
        }
    }


}