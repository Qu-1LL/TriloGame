import * as PIXI from 'pixi.js'
import { toCoords } from './cave.js'
import { Menu } from './menu.js'
import { Ore } from './ores.js'
import { Creature } from './creature.js'
import { Building, BUILD_TILE_HALF_SIZE, Factory, destroyDisplayObject } from './building.js'
import { AlgaeFarm } from './buildings/algae-farm.js'
import { Barracks } from './buildings/barracks.js'
import { MiningPost } from './buildings/mining-post.js'
import { Radar } from './buildings/radar.js'
import { Stats } from './stats.js'

export class Game {

    constructor(app) {
        this.app = app
        this.currentScale = 1
        this.eventListeners = new Map()
        this.cave = null

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

        this.bfsFields = {
            enemy: null,
            colony: null
        }
        this.activeBfsDebugField = null
        this.bfsDebugLabels = new Map()
        this.bfsDebugTextStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 36,
            fill: '#ffd84d',
            align: 'center',
            stroke: {
                color: '#000000',
                width: 3
            }
        })

        this.stats = new Stats(this)

        this.unlockedBuildings = [
            new Factory(AlgaeFarm,this),
            new Factory(Barracks,this),
            new Factory(MiningPost,this),
            new Factory(Radar,this)
        ]

        this.menu = new Menu(app, this, this.uiContainer)

        this.selected = new class {
            constructor(tileContainer,game) {
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

                this.tileContainer = tileContainer
                tileContainer.addChild(this.selection)
                this.game = game
                this.selectedPaths = new Set()
            }

            clearVisuals() {
                this.game.clearFloatingPathPreview()
                this.selection.visible = false

                for (const sprite of this.claySelection) {
                    if (sprite.parent) {
                        sprite.parent.removeChild(sprite)
                    }
                    sprite.destroy()
                }
                this.claySelection.clear()

                for (const sprite of this.selectedPaths) {
                    if (sprite.parent) {
                        sprite.parent.removeChild(sprite)
                    }
                    sprite.destroy()
                }
                this.selectedPaths.clear()
            }

            setSelected(s) {
                this.clearVisuals()

                if (s == null) {
                    this.object = null
                    this.game.menu.setSelectedObject(null)
                    return
                }

                this.object = s
                this.game.menu.setSelectedObject(s)
                this.game.menu.openPanel()
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
            centerSelection() {
                let menuOffset = this.game.menu.getOpenPanelWidth() / 2

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
        }(this.tileContainer,this)
    }

    clearFloatingPathPreview() {
        for (const sprite of this.floatingPaths) {
            if (sprite.parent) {
                sprite.parent.removeChild(sprite)
            }
            sprite.destroy()
        }

        this.floatingPaths.clear()
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

    setBuildingDisplayPivot(displayObject, pivotX, pivotY) {
        if (!displayObject) {
            return false
        }

        if (typeof displayObject.anchor?.set === 'function') {
            displayObject.anchor.set(0)
        }

        if (typeof displayObject.pivot?.set !== 'function') {
            return false
        }

        displayObject.pivot.set(pivotX, pivotY)
        return true
    }

    setPlacedBuildingDisplayPivot(building) {
        if (!building?.sprite) {
            return false
        }

        const pivotBaseSize = building.getDisplayPivotBaseSize?.() ?? building.size

        return this.setBuildingDisplayPivot(
            building.sprite,
            pivotBaseSize.x * BUILD_TILE_HALF_SIZE,
            pivotBaseSize.y * BUILD_TILE_HALF_SIZE
        )
    }

    setFloatingBuildingDisplayPivot(building, rotationState = this.floatingBuilding.rotation) {
        if (!building?.sprite || !this.floatingBuilding.sprite) {
            return false
        }

        const normalizedRotation = ((rotationState % 4) + 4) % 4
        const pivotBaseSize = building.targetBuilding?.getDisplayPivotBaseSize?.()
            ?? building.getDisplayPivotBaseSize?.()
            ?? building.size
        const width = pivotBaseSize.x * BUILD_TILE_HALF_SIZE * 2
        const height = pivotBaseSize.y * BUILD_TILE_HALF_SIZE * 2
        let pivotX = BUILD_TILE_HALF_SIZE
        let pivotY = BUILD_TILE_HALF_SIZE

        if (normalizedRotation === 1) {
            pivotY = height - BUILD_TILE_HALF_SIZE
        } else if (normalizedRotation === 2) {
            pivotX = width - BUILD_TILE_HALF_SIZE
            pivotY = height - BUILD_TILE_HALF_SIZE
        } else if (normalizedRotation === 3) {
            pivotX = width - BUILD_TILE_HALF_SIZE
        }

        return this.setBuildingDisplayPivot(this.floatingBuilding.sprite, pivotX, pivotY)
    }

    updateFloatingBuildingPosition(position) {
        if (!this.buildMode || !this.floatingBuilding.sprite || !position) {
            return false
        }

        this.floatingBuilding.sprite.x = position.x
        this.floatingBuilding.sprite.y = position.y
        this.floatingBuilding.sprite.baseX = position.x
        this.floatingBuilding.sprite.baseY = position.y
        this.floatingBuilding.sprite.scale.set(this.currentScale)
        return true
    }

    beginBuildingPlacement(building, position, previewSprite = null) {
        const floatingPreviewSprite = previewSprite ?? building?.sprite
        if (!building?.sprite || !floatingPreviewSprite) {
            return false
        }

        if (this.floatingBuilding.sprite || this.floatingBuilding.building) {
            this.clearFloatingBuilding({ destroySprite: true })
        }

        this.buildMode = true
        this.floatingBuilding.building = building
        this.floatingBuilding.sprite = floatingPreviewSprite
        this.floatingBuilding.rotation = 0
        this.floatingBuilding.building.setDisplayRotationTurns?.(0)
        this.floatingBuilding.building.targetBuilding?.setDisplayRotationTurns?.(0)
        this.floatingBuilding.sprite.rotation = 0
        this.floatingBuilding.sprite.zIndex = 5
        this.setFloatingBuildingDisplayPivot(building, 0)
        this.floatingBuilding.sprite.scale.set(this.currentScale)
        this.tileContainer.addChild(this.floatingBuilding.sprite)
        return this.updateFloatingBuildingPosition(position)
    }

    rotateFloatingBuilding() {
        if (!this.buildMode || !this.floatingBuilding.building || !this.floatingBuilding.sprite) {
            return false
        }

        this.floatingBuilding.rotation = (this.floatingBuilding.rotation + 1) % 4
        this.floatingBuilding.building.rotateMap()
        this.floatingBuilding.building.setDisplayRotationTurns?.(this.floatingBuilding.rotation)
        this.floatingBuilding.building.targetBuilding?.setDisplayRotationTurns?.(this.floatingBuilding.rotation)
        this.setFloatingBuildingDisplayPivot(this.floatingBuilding.building, this.floatingBuilding.rotation)
        this.floatingBuilding.sprite.scale.set(this.currentScale)
        return true
    }

    formatBfsDebugValue(value) {
        if (!Number.isFinite(value)) {
            return ''
        }

        return String(value)
    }

    showBfsFieldDebug(cave, fieldName, { rebuild = true } = {}) {
        if (!cave || typeof fieldName !== 'string') {
            return false
        }

        if (rebuild && typeof cave.refreshBfsField === 'function') {
            cave.refreshBfsField(fieldName)
        }

        const field = typeof cave.getBfsField === 'function' ? cave.getBfsField(fieldName) : null
        if (!(field instanceof Map)) {
            return false
        }

        this.clearBfsFieldDebug()
        this.activeBfsDebugField = fieldName

        for (const tile of cave.getTiles()) {
            if (typeof cave.isTileRevealed === 'function' ? !cave.isTileRevealed(tile) : tile?.sprite?.visible !== true) {
                continue
            }

            const label = new PIXI.Text({ text: '', style: this.bfsDebugTextStyle })
            label.anchor.set(0.5)
            label.eventMode = 'none'
            label.zIndex = 2.5
            label.text = this.formatBfsDebugValue(field.get(tile.key) ?? Infinity)
            label.baseX = tile.sprite.baseX
            label.baseY = tile.sprite.baseY
            label.x = tile.sprite.x
            label.y = tile.sprite.y
            label.scale.set(this.currentScale)
            label.visible = true
            this.tileContainer.addChild(label)
            this.bfsDebugLabels.set(tile.key, label)
        }

        return true
    }

    refreshBfsFieldDebug(cave, { rebuild = true } = {}) {
        if (!this.activeBfsDebugField) {
            return false
        }

        return this.showBfsFieldDebug(cave, this.activeBfsDebugField, { rebuild })
    }

    clearBfsFieldDebug() {
        for (const label of this.bfsDebugLabels.values()) {
            if (label.parent) {
                label.parent.removeChild(label)
            }
            label.destroy()
        }

        this.bfsDebugLabels.clear()
        this.activeBfsDebugField = null
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

    handleViewportResize(width = this.app.screen.width, height = this.app.screen.height) {
        const nextWidth = Number.isFinite(width) ? width : this.app.screen.width
        const nextHeight = Number.isFinite(height) ? height : this.app.screen.height
        const nextMidX = nextWidth / 2
        const nextMidY = nextHeight / 2
        const scale = this.currentScale || 1

        for (const child of this.tileContainer.children) {
            if (
                !Number.isFinite(child?.x) ||
                !Number.isFinite(child?.y) ||
                !Number.isFinite(child?.baseX) ||
                !Number.isFinite(child?.baseY)
            ) {
                continue
            }

            // Preserve the current on-screen world layout while the viewport center changes.
            child.baseX = nextMidX + ((child.x - nextMidX) / scale)
            child.baseY = nextMidY + ((child.y - nextMidY) / scale)
        }

        this.midx = nextMidX
        this.midy = nextMidY
        this.syncWorldSpriteTransforms()

        if (this.cave) {
            this.refreshBfsFieldDebug(this.cave, { rebuild: false })
        }

        this.menu.refresh()
        return true
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

        if (typeof cave.markAllBuildingFieldsDirty === 'function') {
            cave.markAllBuildingFieldsDirty([tileKey])
        }

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
        const shouldProcessAdjacentCaveTile = (adjacentTile) => {
            if (!adjacentTile || adjacentTile.getBase() === 'wall') {
                return false
            }

            // Radar can reveal tiles before the queen can actually reach them,
            // so we need to treat "visible but still unreachable" as unopened space.
            if (adjacentTile.sprite?.visible === false) {
                return true
            }

            return typeof cave.isTileReachable === 'function'
                ? !cave.isTileReachable(adjacentTile)
                : false
        }

        myTile.texture = PIXI.Texture.from('empty')
        tile.setBase('empty')
        tile.creatureCanFit = true
        if (typeof cave.revealTile === 'function' && cave.revealTile(tile) > 0) {
            changedKeys.add(emptyCoords)
        }

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
                if (typeof cave.revealTile === 'function' && cave.revealTile(n) > 0) {
                    changedKeys.add(n.key)
                }
                continue
            }

            if (shouldProcessAdjacentCaveTile(n)) {
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
                    if (typeof cave.revealTile === 'function' && cave.revealTile(wallTile) > 0) {
                        changedKeys.add(wallTile.key)
                    }
                    continue
                }

                if (shouldProcessAdjacentCaveTile(wallTile)) {
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
            newTile.visible = false

            newTile.scale.set(this.currentScale)

            this.tileContainer.addChild(newTile)
            cave.revealTile(wallTile)

            newTile.on("mouseup", (interactionEvent) => {
                this.whenWallMined(interactionEvent, newTile, cave, newCoords)
            })
        }

        if (shouldRevealCave) {
            cave.revealCave()
        }

        if (typeof cave.refreshReachableTiles === 'function') {
            const reachabilityResult = cave.refreshReachableTiles()
            if (reachabilityResult && typeof cave.markAllBuildingFieldsDirty === 'function') {
                cave.markAllBuildingFieldsDirty([...changedKeys, ...reachabilityResult.changedKeys])
            }
        } else if (typeof cave.markAllBuildingFieldsDirty === 'function') {
            cave.markAllBuildingFieldsDirty([...changedKeys])
        }

        if (typeof cave.notifyMineableTilesChanged === 'function') {
            cave.notifyMineableTilesChanged([...changedKeys])
        }

        if (typeof cave.rebalanceAllBfsFields === 'function') {
            cave.rebalanceAllBfsFields([...changedKeys])
        }

        this.emitMineEvents('wall', cave, emptyCoords, source)
        return true
    }

    cleanActive({ closeMenu = false } = {}) {

        this.clearBfsFieldDebug()
        this.clearFloatingPathPreview()
        this.movePath = false
        this.buildMode = false
        this.clearFloatingBuilding({ destroySprite: true })
        this.selected.setSelected(null)

        if (closeMenu) {
            this.menu.closePanel()
        }
    }

    clearFloatingBuilding({ destroySprite = false } = {}) {
        const floatingSprite = this.floatingBuilding.sprite
        const placementSprite = this.floatingBuilding.building?.sprite
        const targetSprite = this.floatingBuilding.building?.targetBuilding?.sprite

        if (destroySprite) {
            destroyDisplayObject(floatingSprite)
            if (placementSprite && placementSprite !== floatingSprite) {
                destroyDisplayObject(placementSprite)
            }
            if (targetSprite && targetSprite !== floatingSprite && targetSprite !== placementSprite) {
                destroyDisplayObject(targetSprite)
            }
        } else if (floatingSprite?.parent) {
            floatingSprite.parent.removeChild(floatingSprite)
        }

        this.floatingBuilding.building = null
        this.floatingBuilding.sprite = null
        this.floatingBuilding.rotation = 0
    }

    whenWallMined (interactionEvent, myTile, cave, emptyCoords)  {

        if (this.dragging || this.buildMode || cave.getTile(emptyCoords).getBase() != 'wall') {
            return
        }
        this.mineTile(cave, emptyCoords, 'manual')
    }

    emptyTileClicked(coords,myCave) {

        if (!this.dragging && !this.buildMode && this.movePath && myCave.getTile(coords).creatureFits()) {

            const destination = toCoords(coords)
            const field = myCave.buildPointBfsField(destination)
            let path = myCave.buildPathFromField(field, this.selected.object.location)
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
            if(myCave.canBuild(this.floatingBuilding.building,toCoords(coords), { preserveReachability: true })) {
                const placementBuilding = this.floatingBuilding.building
                if (this.floatingBuilding.sprite?.parent) {
                    this.floatingBuilding.sprite.parent.removeChild(this.floatingBuilding.sprite)
                }
                this.floatingBuilding.building = null
                this.floatingBuilding.sprite = null
                this.floatingBuilding.rotation = 0
                myCave.build(placementBuilding,toCoords(coords),placementBuilding.sprite)
                this.buildMode = false
                this.cleanActive()
            }
        }

    }

    emptyTileHover(coords,myCave,event) {

        let pos = event.data.global
        const pointerCoveredByUi = this.menu?.coversScreenPoint?.(pos) ?? false

        if (!this.dragging && 
            !this.buildMode &&
            this.movePath &&
            this.selected.object &&
            !pointerCoveredByUi && (
                myCave.getTile(coords).creatureFits()
            )
        ) {
            this.clearFloatingPathPreview()

            // for (let ore in Ore.getOres()) {
            //     if (myCave.getTile(coords).getBase() === ore.name) {
            //         pathType = 'orepath'
            //         break
            //     }
            // }
            
            const destination = toCoords(coords)
            const field = myCave.buildPointBfsField(destination)
            let path = myCave.buildPathFromField(field, this.selected.object.location)
            this.displayPath(path,this.floatingPaths)
        }
    }

    displayPath(path,pathSet) {
        if (!Array.isArray(path) || path.length === 0) {
            return false
        }

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
            this.clearFloatingPathPreview()
        }
    }


}
