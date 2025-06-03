import * as PIXI from 'pixi.js'
import { toCoords } from './cave.js'

export class Game {

    constructor(app) {
        this.app = app
        this.currentScale = 1

        this.dragging = false;
        this.dragStartPos = null;

        this.totalXDelt = 0
        this.totalYDelt = 0
        
        //setting up stage
        
        this.tileContainer = new PIXI.Container();
        this.tileContainer.sortableChildren = true
        app.stage.addChild(this.tileContainer)

        this.midx = app.screen.width / 2
        this.midy = app.screen.height / 2

        this.floatingPaths = new Set()


        this.selected = new class {
            constructor(tileContainer) {
                this.object = null
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
            setSelected(s) {
                this.object = s
                if (s == null) {
                    this.selection.visible = false
                } else {
                    this.selection.x = s.sprite.position.x
                    this.selection.y = s.sprite.position.y
                    this.selection.baseX = s.sprite.baseX
                    this.selection.baseY = s.sprite.baseY
                    this.selection.visible = true
                }
            }
        }(this.tileContainer)
    }

    cleanActive() {
        for (let sprite of this.floatingPaths) {
            sprite.parent.removeChild(sprite);
            sprite.destroy()
        }
        this.floatingPaths.clear()
        this.selected.setSelected(null)
        
    }

    whenWallMined (interactionEvent, myTile, cave, emptyCoords)  {

        if (this.dragging) {
            return
        }

        myTile.on("mouseup", () => {
            return
        })

        myTile.texture = PIXI.Texture.from('empty')
        let newEmpty = cave.getTile(emptyCoords)
        newEmpty.setBase('empty')
        newEmpty.creatureCanFit = true

        myTile.on("mouseup", () => {
            this.emptyTileClicked(emptyCoords,cave)
        })
        myTile.on("pointerover", () => {
            this.emptyTileHover(emptyCoords,cave)
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
        for (let sprite of this.floatingPaths) {
                sprite.parent.removeChild(sprite);
                sprite.destroy()
            }
        this.floatingPaths.clear()

        if (!this.dragging && this.selected.object && myCave.getTile(coords).creatureCanFit) {

            let path = myCave.bfsPath((this.selected.object.location.x+","+this.selected.object.location.y),coords)
            if(!path) {
                this.selected.setCreature(null)
                return
            } 
            path.shift()
            this.selected.object.queue.clear()
            for (let i = 0; i< path.length;i++) {
                this.selected.object.queue.enqueue(toCoords(path[i]))
            }
        }

        this.selected.setSelected(null)
    }

    emptyTileHover(coords,myCave) {

        if (!this.dragging && this.selected.object !== null && myCave.getTile(coords).creatureFits()) {
            for (let sprite of this.floatingPaths) {
                sprite.parent.removeChild(sprite)
                sprite.destroy()
            }
            this.floatingPaths.clear()


            let path = myCave.bfsPath((this.selected.object.location.x+","+this.selected.object.location.y),coords)
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
                nextSprite.x = this.selected.object.sprite.x + (myDX * 80 * this.currentScale)
                nextSprite.y = this.selected.object.sprite.y + (myDY * 80 * this.currentScale)
                nextSprite.baseX = this.selected.object.sprite.x + (myDX * 80)
                nextSprite.baseY = this.selected.object.sprite.y + (myDY * 80)

                if (dx > 0) {
                    nextSprite.x = nextSprite.position.x + (40 * this.currentScale)
                    nextSprite.basex += 40
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
                nextSprite.zIndex = 2
                nextSprite.anchor.set(0.5)

                if (dy !== 0) {
                    nextSprite.rotation = Math.PI / 2
                }

                this.tileContainer.addChild(nextSprite)
                this.floatingPaths.add(nextSprite)

                myCoords = toCoords(path.shift())
            }
        }
    }

    emptyTileHoverExit() {
        if (!this.dragging && this.selected.object) {
            for (let sprite of this.floatingPaths) {
                sprite.parent.removeChild(sprite)
                sprite.destroy()
            }
            this.floatingPaths.clear()
        }
    }


}