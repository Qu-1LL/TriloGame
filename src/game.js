import * as PIXI from 'pixi.js'
import { toCoords } from './cave.js'
import { Menu } from './menu.js'
import { Ore } from './ores.js'
import { Creature } from './creature.js'
import { Building, Factory } from './building.js'
import { AlgaeFarm } from './buildings/algae-farm.js'
import { Barracks } from './buildings/barracks.js'
import { MiningPost } from './buildings/mining-post.js'
import { Radar } from './buildings/radar.js'
import { Smith } from './buildings/smith.js'
import { Storage } from './buildings/storage.js'
import { Stats } from './stats.js'

export class Game {

    constructor(app) {
        this.app = app
        this.currentScale = 1
        this.eventListeners = new Map()

        //event variables

        this.dragging = false;
        this.dragStartPos = null;
        this.movePath = false
        this.buildMode = false

        this.totalXDelt = 0
        this.totalYDelt = 0
        this.danger = false
        
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

        this.stats = new Stats(this)

        this.unlockedBuildings = [
            new Factory(AlgaeFarm,this),
            new Factory(Barracks,this),
            new Factory(Storage,this),
            new Factory(Smith,this),
            new Factory(MiningPost,this),
            new Factory(Radar,this)
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
                        const myPath = this.object.getQueuedPathPreview()
                        if (myPath.length > 1) {
                            this.game.displayPath(myPath,this.selectedPaths)
                        }
                    } else if (this.object instanceof Building) {
                        for (let tile of this.object.tileArray) {
                            for (let n of tile.getNeighbors()) {
                                if (!this.object.tileArray.includes(n)) {
                                    let myBorder = PIXI.Sprite.from('selectededge')
                                    myBorder.anchor.set(0.5, 0)
                                    this.claySelection.add(myBorder)
                                    this.tileContainer.addChild(myBorder)

                                    let nCoords = toCoords(n.key)
                                    let tileCoords = toCoords(tile.key)
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

    syncWorldSpriteTransforms(extraScreenDx = 0, extraScreenDy = 0, { skipFloatingBuildingOffset = false } = {}) {
        const dx = Number.isFinite(extraScreenDx) ? extraScreenDx : 0
        const dy = Number.isFinite(extraScreenDy) ? extraScreenDy : 0

        for (const child of this.tileContainer.children) {
            child.scale.set(this.currentScale)

            if (!Number.isFinite(child.baseX) || !Number.isFinite(child.baseY)) {
                continue
            }

            if (skipFloatingBuildingOffset && child === this.floatingBuilding.sprite) {
                continue
            }

            child.x = this.midx + ((child.baseX - this.midx) * this.currentScale) + dx
            child.y = this.midy + ((child.baseY - this.midy) * this.currentScale) + dy
        }
    }

    previewWorldPan(screenDx, screenDy) {
        this.syncWorldSpriteTransforms(screenDx, screenDy, { skipFloatingBuildingOffset: true })
    }

    panWorldByScreenDelta(screenDx, screenDy, { skipFloatingBuildingOffset = false } = {}) {
        const dx = Number.isFinite(screenDx) ? screenDx : 0
        const dy = Number.isFinite(screenDy) ? screenDy : 0

        if (dx === 0 && dy === 0) {
            return
        }

        const baseDx = dx * (1 / this.currentScale)
        const baseDy = dy * (1 / this.currentScale)

        this.totalXDelt -= baseDx
        this.totalYDelt -= baseDy

        for (const child of this.tileContainer.children) {
            if (!Number.isFinite(child.baseX) || !Number.isFinite(child.baseY)) {
                continue
            }

            child.baseX += baseDx
            child.baseY += baseDy
        }

        this.syncWorldSpriteTransforms(0, 0, { skipFloatingBuildingOffset })
    }

    on(eventName, listener) {
        if (typeof eventName !== 'string' || eventName.length === 0 || typeof listener !== 'function') {
            return () => {}
        }

        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set())
        }

        this.eventListeners.get(eventName).add(listener)
        return () => this.off(eventName, listener)
    }

    off(eventName, listener) {
        const listeners = this.eventListeners.get(eventName)
        if (!listeners) {
            return false
        }

        const removed = listeners.delete(listener)
        if (listeners.size === 0) {
            this.eventListeners.delete(eventName)
        }
        return removed
    }

    emit(eventName, payload = {}) {
        const listeners = this.eventListeners.get(eventName)
        if (!listeners || listeners.size === 0) {
            return 0
        }

        for (const listener of [...listeners]) {
            listener(payload)
        }

        return listeners.size
    }

    isOreTileType(tileType) {
        for (const ore of Ore.getOres()) {
            if (ore.name === tileType) {
                return true
            }
        }
        return false
    }

    emitMineEvents(tileType, cave, tileKey, source = null) {
        const payload = {
            cave,
            tileKey,
            location: toCoords(tileKey),
            minedType: tileType,
            resourceType: tileType === 'wall' ? 'Sandstone' : tileType,
            source
        }

        this.emit('tileMined', payload)

        if (tileType === 'wall') {
            this.emit('wallMined', payload)
            return
        }

        if (this.isOreTileType(tileType)) {
            this.emit(`${tileType}Mined`, payload)
        }
    }

    mineTile(cave, tileKey, source = null) {
        const tile = cave?.getTile(tileKey)
        if (!tile || !tile.sprite) {
            return false
        }

        const tileType = tile.getBase()
        if (tileType === 'wall') {
            return this.mineWallTile(cave, tile, tileKey, source)
        }

        if (!this.isOreTileType(tileType)) {
            return false
        }

        tile.setBase('empty')
        tile.sprite.texture = PIXI.Texture.from('empty')

        if (typeof cave.notifyMineableTilesChanged === 'function') {
            cave.notifyMineableTilesChanged([tileKey])
        }

        this.emitMineEvents(tileType, cave, tileKey, source)
        return true
    }

    mineWallTile(cave, tile, emptyCoords, source = null) {
        if (!tile || tile.getBase() !== 'wall' || !tile.sprite) {
            return false
        }

        const myTile = tile.sprite
        const changedKeys = new Set([emptyCoords])

        myTile.texture = PIXI.Texture.from('empty')
        tile.setBase('empty')
        tile.creatureCanFit = true

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
        let shouldRevealCave = false
        for (let n of cave.getTile(emptyCoords).getNeighbors()) {
            let nCoords = toCoords(n.key)
            if (nCoords.x - myCoords.x == 1 ) {
                myDelts.delete('e')
            } else if (nCoords.x - myCoords.x == -1) {
                myDelts.delete('w')
            } else if (nCoords.y - myCoords.y == -1) {
                myDelts.delete('n')
            } else {
                myDelts.delete('s')
            }

            if (n.getBase() === 'wall') {
                if (n.sprite?.visible === false) {
                    n.sprite.visible = true
                    changedKeys.add(n.key)
                }
                continue
            }

            if (n.sprite?.visible === false) {
                shouldRevealCave = true
            }
        }

        for (let dir of myDelts.values()) {
            let newCoords = (myCoords.x + dir.x) + "," + (myCoords.y + dir.y)
            let wallTile = cave.getTile(newCoords)
            if (wallTile) {
                tile.addNeighbor(wallTile)
                changedKeys.add(newCoords)

                if (wallTile.getBase() === 'wall') {
                    wallTile.creatureCanFit = false
                    if (wallTile.sprite?.visible === false) {
                        wallTile.sprite.visible = true
                    }
                    continue
                }

                if (wallTile.sprite?.visible === false) {
                    shouldRevealCave = true
                }
                continue
            }

            wallTile = cave.addTile(newCoords)
            wallTile.setBase('wall')
            wallTile.creatureCanFit = false
            changedKeys.add(newCoords)

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
            newTile.x = myTile.x + (dir.x * 80 * this.currentScale)
            newTile.y = myTile.y + (dir.y * 80 * this.currentScale)
            newTile.baseX = myTile.baseX + (dir.x * 80)
            newTile.baseY = myTile.baseY + (dir.y * 80)

            newTile.anchor.set(0.5)
            newTile.interactive = true;
            newTile.buttonMode = true;

            newTile.scale.set(this.currentScale)

            this.tileContainer.addChild(newTile)

            newTile.on("mouseup", (interactionEvent) => {
                this.whenWallMined(interactionEvent, newTile, cave, newCoords)
            })
        }

        if (shouldRevealCave) {
            cave.revealCave()
        }

        if (typeof cave.notifyMineableTilesChanged === 'function') {
            cave.notifyMineableTilesChanged([...changedKeys])
        }

        this.emitMineEvents('wall', cave, emptyCoords, source)
        return true
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
        this.mineTile(cave, emptyCoords, 'manual')
    }

    emptyTileClicked(coords,myCave) {

        if (!this.dragging && !this.buildMode && this.movePath && myCave.getTile(coords).creatureFits()) {

            let path = myCave.bfsPath((this.selected.object.location.x+","+this.selected.object.location.y),coords)
            if(!path) {
                this.selected.setSelected(null)
                return
            } 
            this.selected.object.queueMovePath(path)
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
