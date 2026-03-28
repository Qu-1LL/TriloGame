
import * as PIXI from 'pixi.js'
import {Graph, Tile } from './graph-data.js'
import { Ore } from './ores.js'
import { BUILD_TILE_HALF_SIZE, destroyDisplayObject } from './building.js'
import { BfsField } from './bfs-field.js'

const sizeMult = 30
//Usually 12 ^^^
const holeLimit = 10
const degradeLimit = 2.75
//Usually 3
const degradeDeviation = 0.7
const cavernCount = 25
//Usually 100 ^^^
const radius = 20
//Usually 20
const oreMult = 300
const oreDist = 8
//Usually 10


export function toCoords(coords) {
    let x = 0
    let y = 0
    try {
        [x, y] = coords.split(",").map(Number)
    } catch (e) {
        return coords
    }
    return {x: x, y: y}
}

export function toKey(location) {
    try {
        return location.x+","+location.y
    } catch (e) {
        return location
    }
}

function isTrackedTrilobite(creature) {
    return creature?.constructor?.name === 'Trilobite'
}

function isEnemyCreature(creature) {
    return creature?.assignment === 'enemy' || creature?.constructor?.name === 'Enemy'
}


export class Cave extends Graph {

    constructor (app, game) {
        super()
        // while( this.tiles.size < 28000) {
        //     this.tiles = new Map();
        //     this.#generateCaveShrink();
        // }
        this.#generateCaveShrink();
        this.trilobites = new Set();
        this.enemies = new Set();
        this.buildings = new Set();
        this.revealedTiles = new Set();
        this.reachableTiles = new Set();
        this.app = app
        this.game = game
        if (this.game) {
            this.game.cave = this
        }
        this.resetBfsFields()

        for (let coords of this.tiles.keys()) {
            let myAsset = this.getTile(coords).getBase()
            let myTile = PIXI.Sprite.from(myAsset)
            this.getTile(coords).sprite = myTile
    
            if (myAsset == 'wall') {
                myTile.on("mouseup", (interactionEvent) => {
                    this.game.whenWallMined(interactionEvent, myTile, this, coords)
                })
            } else {
                myTile.on("mouseup", () => {
                    this.game.emptyTileClicked(coords,this)
                })
                myTile.on("pointerover", (event) => {
                    this.game.emptyTileHover(coords,this,event)
                })
                myTile.on("pointerout", () => {
                    this.game.emptyTileHoverExit()
                })
            }
    
            myTile.anchor.set(0.5)
            let myCoords = toCoords(coords)
    
            myTile.x = this.game.midx + (myCoords.x * 80)
            myTile.y = this.game.midy + (myCoords.y * 80)
            myTile.baseX = myTile.position.x
            myTile.baseY = myTile.position.y
            myTile.zIndex = 0
            myTile.visible = false
    
            this.game.tileContainer.addChild(myTile)
    
            myTile.interactive = true;
            myTile.buttonMode = true;
        }
    }

    #generateCaveShrink() {
        //generates starting area
        this.#fillCircle(0,0,radius)

        //generates new circles
        let origins = [{x:0, y:0}]
        for(let i = 0; i < cavernCount; i++) {
            let randNum = Math.floor(Math.random() * origins.length)
            let myConst = Math.random();
            let xOffset = radius * 2 * myConst + radius * Math.random() 
            let yOffset = radius * 2 * (1 - myConst) + radius * Math.random() 
            
            let myOrigin = {x: Math.floor(origins[randNum].x + xOffset), y: Math.floor(origins[randNum].y + yOffset)}
            let neg = Math.random()
            if (neg > 0.5) {
                myOrigin.x = -myOrigin.x
            }
            neg = Math.random()
            if (neg > 0.5) {
                myOrigin.y = -myOrigin.y
            }
            let tooClose = false;
            for (let origin of origins) {
                if (isInCircle(myOrigin.x,myOrigin.y,origin.x,origin.y,radius)) {
                    i--;
                    tooClose = true
                    break;
                }
            }
            if (tooClose) {
                continue;
            }
            origins.push(myOrigin)

            let newRadius = Math.floor((0.5 + Math.random()) * radius)
            this.#fillCircle(myOrigin.x,myOrigin.y,newRadius)

        }

        //shaves off random tiles
        let myValues = [...this.tiles.keys()]
        myValues = shuffleArray(myValues)
        let count = 0
        for (let i = 0; i < myValues.length; i++) {
            let myCoords = toCoords(myValues[i])
            if (this.getTile(myValues[i]).getNeighbors().size == 4 && !isInCircle(myCoords.x,myCoords.y,0,0,radius/2)) {
                this.removeTile(myValues[i])
                count++
            }
            if (count > (radius * holeLimit) + (cavernCount * holeLimit)) {
                break;
            }
        }
        
        for (let i = 0; i < 2 + (radius / sizeMult) + (radius / cavernCount) ; i++) {
            this.#degradeCave()
        }

        //bit of cleanup
        myValues = [...this.tiles.keys()]
        for (let i = 0; i < myValues.length; i++) {
            if (this.getTile(myValues[i]).getNeighbors().size == 0) {
                this.removeTile(myValues[i])
            }
        }


        //add cave walls
        myValues = [...this.tiles.keys()]
        for (let i = 0; i < myValues.length; i++) {
            if (this.getTile(myValues[i]).getNeighbors().size < 4) {
                this.getTile(myValues[i]).setBase('wall')
                this.getTile(myValues[i]).creatureCanFit = false
            }
        }
        
        //bit of cleanup for walls
        myValues = [...this.tiles.keys()]
        for (let i = 0; i < myValues.length; i++) {
            if (this.getTile(myValues[i]).getBase() == 'wall') {
                let willDelete = true
                for (let n of this.getTile(myValues[i]).getNeighbors()) {
                    if (n.getBase() == 'empty') {
                        willDelete = false
                    }
                }
                if (willDelete) {
                    this.removeTile(myValues[i])
                }
            }
        }

        this.#fillOres()
    }

    #generateCaveGrowth() {
        
    }

    #degradeCave() {
        let myValues = [...this.tiles.keys()]
        myValues = shuffleArray(myValues)
        for (let i = 0; i < myValues.length; i++) {
            let randNum = randomNormal(this.getTile(myValues[i]).getNeighbors().size, degradeDeviation)
            if (randNum < degradeLimit && this.getTile(myValues[i]).getNeighbors().size < 4) {
                this.removeTile(myValues[i])
            }
        }
    }

    #fillOres() {

        //this code is stupid but guarantees player has access to sandstone & algae easily
        let dumbSuccess = true
        while (dumbSuccess) {
            let dumbX = Math.floor(Math.random() * 17) - 8
            let dumbY = Math.floor(Math.random() * 17) - 8
            if (this.getTile(dumbX+","+dumbY) && this.getTile(dumbX+","+dumbY).getBase() == 'empty') {
                this.getTile(dumbX+","+dumbY).setBase('Sandstone')
                dumbSuccess = false
            }
        }
        dumbSuccess = true
        while (dumbSuccess) {
            let dumbX = Math.floor(Math.random() * 13) - 6
            let dumbY = Math.floor(Math.random() * 13) - 6
            if (this.getTile(dumbX+","+dumbY) && this.getTile(dumbX+","+dumbY).getBase() == 'empty') {
                this.getTile(dumbX+","+dumbY).setBase('Algae')
                dumbSuccess = false
            }
        }
        dumbSuccess = true
        while (dumbSuccess) {
            let dumbX = Math.floor(Math.random() * 13) - 6
            let dumbY = Math.floor(Math.random() * 13) - 6
            if (this.getTile(dumbX+","+dumbY) && this.getTile(dumbX+","+dumbY).getBase() == 'empty') {
                this.getTile(dumbX+","+dumbY).setBase('Magnetite')
                dumbSuccess = false
            }
        }

        let oreCount = 0;
        for(let ore of Ore.getOres()) {
            let count = 0
            for (let tile of shuffleArray(this.getTiles())) {

                let myLower = Math.abs(randomNormal( 3 * cavernCount * oreCount ,cavernCount * (Ore.getOres().length - oreCount)) / oreDist)
                let myUpper = Math.abs(randomNormal( 3 * cavernCount * (oreCount + 3),2 * cavernCount * (Ore.getOres().length - oreCount)) / oreDist)
                let myCoords = toCoords(tile.key)
                let myVect = getDistance(myCoords.x,myCoords.y,0,0) 
                if ( myVect > myLower && myVect < myUpper && tile.getBase() == 'empty') {
                    tile.setBase(ore.name)
                    let veinCount = 0
                    let myNum = Math.random()
                    while(myNum < 0.85 && veinCount <= 2 + (Ore.getOres().length - oreCount)) {
                        let n = tile.getRandomNeighbor()
                        let brokenCount = 0
                        while (n.getBase() != 'empty' && brokenCount < 4) {
                            n = n.getRandomNeighbor()
                            brokenCount++
                        }
                        if (brokenCount < 4) {
                            n.setBase(ore.name)
                        }
                        myNum = Math.random()
                        veinCount++
                    }
                    count++
                }
                if (count >= (cavernCount / 5) + (cavernCount * radius * (Ore.getOres().length - oreCount)) / oreMult) {
                    break
                }
            }
            // console.log(ore.name+" spawned "+count+" veins / "+ Math.ceil(((cavernCount / 5) + (cavernCount * radius * (Ore.getOres().length - oreCount)) / oreMult)))
            oreCount++
        }
    }

    #fillCircle(ox,oy,radius) {
        for (let x = ox-radius; x < ox+ radius + 1; x++) {
            for (let y = oy-radius; y < oy+radius + 1; y++) {
                if (!isInCircle(x,y,ox,oy,radius)) {
                    continue;
                }
                this.addTile(x+","+y)
                if (this.tiles.has((x-1)+","+y)) {
                    this.addEdge(x+","+y,(x-1)+","+y)
                }
                if (this.tiles.has(x+","+(y-1))) {
                    this.addEdge(x+","+y,x+","+(y-1))
                }
            }
        } 
    }

    canBuild(building,location) {
        const hasQueen = this.getQueenBuilding() !== null
        const buildingIsQueen = building?.name === 'Queen' || building?.constructor?.name === 'Queen'
        const requireReachableTiles = hasQueen && !buildingIsQueen

        for(let x = 0; x < building.size.x; x++) {
            for (let y = 0; y < building.size.y; y++) {
                if (building.openMap[y][x] > 1) {
                    continue
                }
                let theseCoords = (location.x + x) + "," + (location.y + y)
                let curTile = this.tiles.get(theseCoords)
                if (curTile === undefined) {
                    return false
                }
                if (curTile.getBuilt() || curTile.getBase() !== 'empty' || !curTile.creatureFits()) {
                    return false
                }
                if (requireReachableTiles && !this.isTileReachable(curTile)) {
                    return false
                }
            }
        }
        return true
    }

    build(building,location,sprite = null) {
        if (!this.canBuild(building,location)) {
            return false
        }

        const displayObject = sprite ?? building?.sprite
        if (!displayObject) {
            return false
        }

        this.buildings.add(building)
        building.sprite = displayObject
        building.cave = this
        if (typeof building.getBfsFieldObject === 'function') {
            building.getBfsFieldObject()?.setCave?.(this)
            building.getBfsFieldObject()?.setOwnerBuilding?.(building)
        }
        building.tileArray = []
        building.setLocation(location.x,location.y)

        for(let x = 0; x < building.size.x; x++) {
            for (let y = 0; y < building.size.y; y++) {
                let theseCoords = (location.x + x) + "," + (location.y + y)
                let curTile = this.tiles.get(theseCoords)
                building.tileArray.push(curTile)
                if (building.openMap[y][x] > 1) {
                    continue
                }
                curTile.setBuilt(building)
                curTile.creatureCanFit = (building.openMap[y][x] >= 1)
            }
        }

        if (typeof building.onBuilt === 'function') {
            building.onBuilt(this)
        }

        const dirtyKeys = building.tileArray.map((tile) => tile.key)
        const reachabilityResult = this.refreshReachableTiles()
        this.markAllBuildingFieldsDirty([...dirtyKeys, ...reachabilityResult.changedKeys], [building])

        let tileSprite = this.getTile(location.x+","+location.y).sprite

        displayObject.x = tileSprite.x + ((building.size.x - 1) * (BUILD_TILE_HALF_SIZE * this.game.currentScale))
        displayObject.y = tileSprite.y + ((building.size.y - 1) * (BUILD_TILE_HALF_SIZE * this.game.currentScale))
        displayObject.baseX = tileSprite.baseX + ((building.size.x - 1) * BUILD_TILE_HALF_SIZE)
        displayObject.baseY = tileSprite.baseY + ((building.size.y - 1) * BUILD_TILE_HALF_SIZE)
        if (typeof this.game.setPlacedBuildingDisplayPivot === 'function') {
            this.game.setPlacedBuildingDisplayPivot(building)
        } else if (typeof displayObject.pivot?.set === 'function') {
            displayObject.pivot.set(building.size.x * BUILD_TILE_HALF_SIZE, building.size.y * BUILD_TILE_HALF_SIZE)
        }
        displayObject.scale.set(this.game.currentScale)
        displayObject.interactive = true;
        displayObject.buttonMode = true;
        displayObject.zIndex = 1

        displayObject.on('pointermove', (event) => {
            let pos = event.data.global;

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('pointerover', event);
                    break;
                }
            }
        });

        displayObject.on('mouseup', (event) => {
            if (this.game.dragging) {
                return;
            }

            let pos = event.data.global;

            let carryModes = this.game.movePath || this.game.buildMode

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('mouseup', event);
                    break;
                }
            }

            if (
                this.game.selected.object == null &&
                !carryModes &&
                (typeof building.canBeSelected !== 'function' || building.canBeSelected())
            ) {
                this.game.selected.setSelected(building)
            }
        });

        displayObject.on('pointerout', (event) => {
            let pos = event.data.global;

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('pointerout', event);
                    break;
                }
            }
        });

        this.game.tileContainer.addChild(displayObject)
        this.rebalanceAllBfsFields(building.tileArray.map((tile) => tile.key), [building])

        return true
    }

    removeBuilding(building, source = null) {
        if (!building || !this.buildings.has(building)) {
            return false
        }

        const dirtyKeys = []
        for (const tile of building.tileArray) {
            if (!tile) {
                continue
            }

            dirtyKeys.push(tile.key)

            if (tile.getBuilt() === building) {
                tile.setBuilt(null)
            }

            tile.creatureCanFit = true
        }

        this.buildings.delete(building)

        for (const creature of this.getCreatures()) {
            if (!creature) {
                continue
            }

            const assignedBuilding = typeof creature.getAssignedBuilding === 'function'
                ? creature.getAssignedBuilding()
                : creature.assignedBuilding

            if (assignedBuilding !== building) {
                continue
            }

            if (typeof creature.clearActionQueue === 'function') {
                creature.clearActionQueue()
            }

            if (typeof creature.releaseAssignedBuilding === 'function') {
                creature.releaseAssignedBuilding()
            } else if ('assignedBuilding' in creature) {
                creature.assignedBuilding = null
            }
        }

        if (typeof building.cleanupBeforeRemoval === 'function') {
            building.cleanupBeforeRemoval(source)
        }

        const reachabilityResult = this.refreshReachableTiles()
        this.markAllBuildingFieldsDirty([...dirtyKeys, ...reachabilityResult.changedKeys], [building])

        if (this.game?.selected?.object === building && typeof this.game.cleanActive === 'function') {
            this.game.cleanActive()
        }

        destroyDisplayObject(building.sprite)

        building.tileArray = []
        building.location = { x: null, y: null }
        building.cave = null
        if (typeof building.getBfsFieldObject === 'function') {
            building.getBfsFieldObject()?.setCave?.(null)
        }

        this.rebalanceAllBfsFields(dirtyKeys, [building])
        return true
    }

    getQueenBuilding() {
        for (const building of this.buildings) {
            if (!building) {
                continue
            }

            if (building.name === 'Queen' || building.constructor?.name === 'Queen') {
                return building
            }
        }

        return null
    }

    isTileRevealed(tile) {
        return this.revealedTiles.has(tile)
    }

    getRevealedTiles() {
        return [...this.revealedTiles]
    }

    isTileReachable(tile) {
        return this.reachableTiles.has(tile)
    }

    getReachableTiles() {
        return [...this.reachableTiles]
    }

    getReachabilityChangedKeys(previousReachableTiles, nextReachableTiles) {
        const changedKeys = new Set()

        for (const tile of previousReachableTiles) {
            if (!nextReachableTiles.has(tile)) {
                changedKeys.add(tile.key)
            }
        }

        for (const tile of nextReachableTiles) {
            if (!previousReachableTiles.has(tile)) {
                changedKeys.add(tile.key)
            }
        }

        return [...changedKeys]
    }

    refreshReachableTiles() {
        const previousReachableTiles = this.reachableTiles
        const queenBuilding = this.getQueenBuilding()
        const nextReachableTiles = new Set()

        if (!queenBuilding || !Array.isArray(queenBuilding.tileArray) || queenBuilding.tileArray.length === 0) {
            this.reachableTiles = nextReachableTiles
            return {
                count: 0,
                changedKeys: this.getReachabilityChangedKeys(previousReachableTiles, nextReachableTiles)
            }
        }

        const queue = []
        const visited = new Set()

        for (const tile of queenBuilding.tileArray) {
            if (!tile?.creatureFits() || visited.has(tile.key)) {
                continue
            }

            visited.add(tile.key)
            queue.push(tile)
        }

        let queueHead = 0

        while (queueHead < queue.length) {
            const currentTile = queue[queueHead]
            queueHead++

            if (!currentTile?.creatureFits()) {
                continue
            }

            nextReachableTiles.add(currentTile)

            for (const neighbor of currentTile.getNeighbors()) {
                if (!neighbor?.creatureFits() || visited.has(neighbor.key)) {
                    continue
                }

                visited.add(neighbor.key)
                queue.push(neighbor)
            }
        }

        this.reachableTiles = nextReachableTiles
        return {
            count: this.reachableTiles.size,
            changedKeys: this.getReachabilityChangedKeys(previousReachableTiles, nextReachableTiles)
        }
    }

    getBuildingBfsFieldObject(building) {
        if (!building) {
            return null
        }

        if (!(building.bfsField instanceof BfsField)) {
            building.bfsField = new BfsField({
                name: building?.name ?? 'Building',
                type: 'building',
                ownerBuilding: building,
                cave: this
            })
        }

        building.bfsField.setOwnerBuilding(building)
        building.bfsField.setCave(building.cave ?? this)
        return building.bfsField
    }

    ensureBuildingBfsField(building) {
        const fieldObject = this.getBuildingBfsFieldObject(building)
        return fieldObject ? fieldObject.getField() : null
    }

    markAllBuildingFieldsDirty(tileKeys = [], dirtyBuildings = [], dirtyCreatures = []) {
        for (const building of this.buildings) {
            const fieldObject = this.getBuildingBfsFieldObject(building)
            if (!fieldObject) {
                continue
            }

            fieldObject.markDirty({
                tileKeys,
                buildings: dirtyBuildings,
                creatures: dirtyCreatures
            })
        }

        return true
    }

    getFieldNextStep(field, location) {
        if (!(field instanceof Map) || !location) {
            return null
        }

        const tempField = new BfsField({ cave: this })
        tempField.setField(field)
        return tempField.getNextStep(location, { refresh: false })
    }

    buildPathFromField(field, startLocation) {
        if (!(field instanceof Map) || !startLocation) {
            return null
        }

        const tempField = new BfsField({ cave: this })
        tempField.setField(field)
        return tempField.buildPathFrom(startLocation, { refresh: false })
    }

    buildPointBfsField(destination) {
        const destinationKey = toKey(destination)
        const destinationTile = this.getTile(destinationKey)
        if (!destinationTile || !destinationTile.creatureFits() || !this.isTileReachable(destinationTile)) {
            return null
        }

        const field = new Map()
        const queue = [destinationKey]
        let queueHead = 0

        for (const tile of this.getReachableTiles()) {
            if (!tile.creatureFits()) {
                continue
            }
            field.set(tile.key, Infinity)
        }

        field.set(destinationKey, 0)

        while (queueHead < queue.length) {
            const currentKey = queue[queueHead]
            queueHead++

            const currentTile = this.getTile(currentKey)
            if (!currentTile) {
                continue
            }

            const currentValue = field.get(currentKey) ?? Infinity
            if (!Number.isFinite(currentValue)) {
                continue
            }

            for (const neighbor of currentTile.getNeighbors()) {
                if (!neighbor.creatureFits() || !this.isTileReachable(neighbor)) {
                    continue
                }

                const nextValue = currentValue + 1
                if (nextValue >= (field.get(neighbor.key) ?? Infinity)) {
                    continue
                }

                field.set(neighbor.key, nextValue)
                queue.push(neighbor.key)
            }
        }

        return field
    }

    getBuildingBfsFieldValue(building, location) {
        const fieldObject = this.getBuildingBfsFieldObject(building)
        return fieldObject ? fieldObject.getFieldValue(location) : Infinity
    }

    getBuildingBfsFieldNextStep(building, location) {
        const fieldObject = this.getBuildingBfsFieldObject(building)
        return fieldObject ? fieldObject.getNextStep(location) : null
    }

    revealTile(tile, revealedKeys = null) {
        if (!tile?.sprite) {
            return 0
        }

        const wasRevealed = this.isTileRevealed(tile)
        this.revealedTiles.add(tile)
        tile.sprite.visible = true

        if (wasRevealed) {
            return 0
        }

        if (revealedKeys instanceof Set) {
            revealedKeys.add(tile.key)
        }
        return 1
    }

    revealTiles(tiles) {
        if (!Array.isArray(tiles) || tiles.length === 0) {
            return 0
        }

        const revealedKeys = new Set()
        let revealedCount = 0
        for (const tile of tiles) {
            revealedCount += this.revealTile(tile, revealedKeys)
        }

        if (revealedKeys.size > 0) {
            this.rebalanceAllBfsFields([...revealedKeys])
        }

        return revealedCount
    }

    revealTilesInRadius(centerLocations, radius) {
        if (!Array.isArray(centerLocations) || centerLocations.length === 0 || !Number.isFinite(radius) || radius < 0) {
            return 0
        }

        const radiusSq = radius * radius
        const revealedKeys = new Set()
        let revealedCount = 0

        for (const tile of this.getTiles()) {
            const tileCoords = toCoords(tile.key)
            for (const center of centerLocations) {
                if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y)) {
                    continue
                }

                const dx = tileCoords.x - center.x
                const dy = tileCoords.y - center.y
                if ((dx * dx) + (dy * dy) > radiusSq) {
                    continue
                }

                revealedCount += this.revealTile(tile, revealedKeys)
                break
            }
        }

        if (revealedKeys.size > 0) {
            this.rebalanceAllBfsFields([...revealedKeys])
        }

        return revealedCount
    }

    revealTilesBetweenRadii(centerLocations, innerRadius, outerRadius) {
        if (!Array.isArray(centerLocations) || centerLocations.length === 0 || !Number.isFinite(outerRadius) || outerRadius < 0) {
            return 0
        }

        const minRadius = Math.max(-1, Number.isFinite(innerRadius) ? innerRadius : -1)
        if (outerRadius <= minRadius) {
            return 0
        }

        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        const validCenters = []

        for (const center of centerLocations) {
            if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y)) {
                continue
            }

            validCenters.push(center)
            if (center.x < minX) {
                minX = center.x
            }
            if (center.x > maxX) {
                maxX = center.x
            }
            if (center.y < minY) {
                minY = center.y
            }
            if (center.y > maxY) {
                maxY = center.y
            }
        }

        if (validCenters.length === 0) {
            return 0
        }

        const innerRadiusSq = minRadius * minRadius
        const outerRadiusSq = outerRadius * outerRadius
        const revealedKeys = new Set()
        let revealedCount = 0

        for (let x = Math.floor(minX - outerRadius); x <= Math.ceil(maxX + outerRadius); x++) {
            for (let y = Math.floor(minY - outerRadius); y <= Math.ceil(maxY + outerRadius); y++) {
                const tile = this.getTile(x + "," + y)
                if (!tile) {
                    continue
                }

                let insideOuter = false
                let insideInner = false

                for (const center of validCenters) {
                    const dx = x - center.x
                    const dy = y - center.y
                    const distSq = (dx * dx) + (dy * dy)

                    if (distSq <= outerRadiusSq) {
                        insideOuter = true
                        if (distSq <= innerRadiusSq) {
                            insideInner = true
                            break
                        }
                    }
                }

                if (insideOuter && !insideInner) {
                    revealedCount += this.revealTile(tile, revealedKeys)
                }
            }
        }

        if (revealedKeys.size > 0) {
            this.rebalanceAllBfsFields([...revealedKeys])
        }

        return revealedCount
    }

    revealCave() {
        const queenBuilding = this.getQueenBuilding()
        if (!queenBuilding || !Array.isArray(queenBuilding.tileArray) || queenBuilding.tileArray.length === 0) {
            return 0
        }

        const queue = []
        const visited = new Set()

        for (const tile of queenBuilding.tileArray) {
            if (!tile || typeof tile.key !== 'string' || visited.has(tile.key)) {
                continue
            }
            visited.add(tile.key)
            queue.push(tile)
        }

        let queueHead = 0
        const revealedKeys = new Set()
        let revealedCount = 0

        while (queueHead < queue.length) {
            const currentTile = queue[queueHead]
            queueHead++

            revealedCount += this.revealTile(currentTile, revealedKeys)

            if (!currentTile || currentTile.getBase() === 'wall') {
                continue
            }

            for (const neighbor of currentTile.getNeighbors()) {
                if (!neighbor || visited.has(neighbor.key)) {
                    continue
                }

                visited.add(neighbor.key)
                revealedCount += this.revealTile(neighbor, revealedKeys)

                if (neighbor.getBase() !== 'wall') {
                    queue.push(neighbor)
                }
            }
        }

        if (revealedKeys.size > 0) {
            this.rebalanceAllBfsFields([...revealedKeys])
        }

        return revealedCount
    }

    notifyMineableTilesChanged(tileKeys) {
        if (!Array.isArray(tileKeys) || tileKeys.length === 0) {
            return
        }

        for (const building of this.buildings) {
            if (typeof building.invalidateMineableQueuesForKeys === 'function') {
                building.invalidateMineableQueuesForKeys(tileKeys)
            }
        }
    }

    getBfsFieldNames() {
        return ['enemy', 'colony']
    }

    resetBfsFields() {
        if (!this.game) {
            return null
        }

        this.game.bfsFields = {
            enemy: new BfsField({
                name: 'enemy',
                type: 'enemy',
                cave: this
            }),
            colony: new BfsField({
                name: 'colony',
                type: 'colony',
                cave: this
            })
        }

        return this.game.bfsFields
    }

    getBfsFieldObject(fieldName) {
        if (fieldName === 'queen') {
            const queenBuilding = this.getQueenBuilding()
            return queenBuilding ? this.getBuildingBfsFieldObject(queenBuilding) : null
        }

        if (!this.game?.bfsFields || typeof fieldName !== 'string') {
            return null
        }

        if (!(this.game.bfsFields[fieldName] instanceof BfsField)) {
            this.game.bfsFields[fieldName] = new BfsField({
                name: fieldName,
                type: fieldName,
                cave: this
            })
        }

        this.game.bfsFields[fieldName].setCave(this)
        return this.game.bfsFields[fieldName]
    }

    getBfsField(fieldName) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        return fieldObject ? fieldObject.getField() : null
    }

    refreshBfsField(fieldName) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        return fieldObject ? fieldObject.refresh() : null
    }

    rebuildBfsField(fieldName) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        return fieldObject ? fieldObject.rebuild() : null
    }

    markSharedBfsFieldsDirty(tileKeys = [], dirtyBuildings = [], dirtyCreatures = []) {
        for (const fieldName of this.getBfsFieldNames()) {
            const fieldObject = this.getBfsFieldObject(fieldName)
            if (!fieldObject) {
                continue
            }

            fieldObject.markDirty({
                tileKeys,
                buildings: dirtyBuildings,
                creatures: dirtyCreatures
            })
        }

        return this.getBfsFields()
    }

    rebalanceBfsField(fieldName, dirtyKeys = [], dirtyBuildings = [], dirtyCreatures = []) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        if (!fieldObject) {
            return null
        }

        fieldObject.markDirty({
            tileKeys: dirtyKeys,
            buildings: dirtyBuildings,
            creatures: dirtyCreatures
        })

        return fieldObject.refresh()
    }

    rebalanceAllBfsFields(dirtyKeys = [], dirtyBuildings = [], dirtyCreatures = []) {
        for (const fieldName of this.getBfsFieldNames()) {
            this.rebalanceBfsField(fieldName, dirtyKeys, dirtyBuildings, dirtyCreatures)
        }

        return this.getBfsFields()
    }

    getBfsFields() {
        return this.game?.bfsFields ?? null
    }

    getBfsFieldValue(fieldName, location) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        return fieldObject ? fieldObject.getFieldValue(location) : Infinity
    }

    getBfsFieldNextStep(fieldName, location) {
        const fieldObject = this.getBfsFieldObject(fieldName)
        return fieldObject ? fieldObject.getNextStep(location) : null
    }

    getCreatureBfsFieldNames(creature) {
        if (isEnemyCreature(creature)) {
            return ['enemy']
        }

        if (isTrackedTrilobite(creature)) {
            return ['colony']
        }

        return []
    }

    markCreatureBfsFieldsDirty(creature, tileKeys = []) {
        for (const fieldName of this.getCreatureBfsFieldNames(creature)) {
            const fieldObject = this.getBfsFieldObject(fieldName)
            if (!fieldObject) {
                continue
            }

            fieldObject.markDirty({
                tileKeys,
                creatures: [creature]
            })
        }

        return true
    }

    getCreatures() {
        return [...this.trilobites, ...this.enemies]
    }

    getCreatureCollection(creature) {
        if (isEnemyCreature(creature)) {
            return this.enemies
        }

        if (isTrackedTrilobite(creature)) {
            return this.trilobites
        }

        return null
    }

    hasEnemies() {
        return this.enemies.size > 0
    }

    restoreAllCreatureHealth() {
        let restoredCount = 0

        for (const creature of this.trilobites) {
            if (!creature || typeof creature.restoreHealth !== 'function') {
                continue
            }

            creature.restoreHealth()
            restoredCount++
        }

        return restoredCount
    }

    syncTrilobiteTileOccupancy(creature, fromTile = null, toTile = null) {
        if (!isTrackedTrilobite(creature)) {
            return false
        }

        if (fromTile && typeof fromTile.removeTrilobite === 'function') {
            fromTile.removeTrilobite(creature)
        }

        if (toTile && typeof toTile.addTrilobite === 'function') {
            toTile.addTrilobite(creature)
        }

        return true
    }

    removeCreature(creature, source = null) {
        if (!creature) {
            return false
        }

        const creatureCollection = this.getCreatureCollection(creature)
        if (!creatureCollection?.has(creature)) {
            return false
        }

        const removedEnemy = isEnemyCreature(creature)

        if (this.game.selected.object === creature) {
            this.game.cleanActive()
        }

        creature.clearActionQueue()
        if (typeof creature.cleanupBeforeRemoval === 'function') {
            creature.cleanupBeforeRemoval(source)
        }

        for (const building of this.buildings) {
            if (typeof building.removeAssignment === 'function') {
                building.removeAssignment(creature)
            }
        }

        const currentTile = this.getTile(toKey(creature.location))
        this.syncTrilobiteTileOccupancy(creature, currentTile, null)

        creatureCollection.delete(creature)

        if (removedEnemy && !this.hasEnemies()) {
            this.game.danger = false
            this.restoreAllCreatureHealth()
        }

        if (creature.sprite?.parent) {
            creature.sprite.parent.removeChild(creature.sprite)
        }

        if (typeof creature.sprite?.destroy === 'function') {
            creature.sprite.destroy()
        }

        this.markCreatureBfsFieldsDirty(creature, currentTile ? [currentTile.key] : [])
        creature.location = { x: null, y: null }
        creature.cave = null
        return true
    }

    spawn(creature,tile) {
        if (!creature || !tile || !tile.sprite) {
            return false
        }

        if (tile.getBase() == 'wall' || !tile.creatureFits() || !this.isTileReachable(tile)) {
            return false
        }

        const creatureCollection = this.getCreatureCollection(creature)
        if (!creatureCollection) {
            return false
        }

        const previousTile = this.getTile(toKey(creature.location))
        const spawnLocation = toCoords(tile.key)
        creature.location = { x: spawnLocation.x, y: spawnLocation.y }
        this.syncTrilobiteTileOccupancy(creature, previousTile, tile)

        const tileSprite = tile.sprite
        creature.sprite.anchor.set(0.5)
        if (!creature.placeSpriteOnTile(tileSprite)) {
            return false
        }
        creature.sprite.scale.set(this.game.currentScale)
        creature.sprite.interactive = true;
        creature.sprite.buttonMode = true;
        creature.sprite.zIndex = 2
        creature.cave = this

        this.game.tileContainer.addChild(creature.sprite)

        creatureCollection.add(creature)

        if (isEnemyCreature(creature) && this.game.danger === false) {
            this.game.danger = true
        }

        this.markCreatureBfsFieldsDirty(creature, [tile.key])

        return true
    }

    moveCreature(creature, nextLocation) {
        if (!creature || !nextLocation) {
            return false
        }

        const current = toCoords(creature.location)
        const next = toCoords(nextLocation)

        if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) {
            return false
        }

        const nextTile = this.getTile(toKey(next))
        if (nextTile === undefined || !nextTile.creatureFits()) {
            return false
        }

        const currentTile = this.getTile(toKey(current))

        const moveDist = Math.abs(current.x - next.x) + Math.abs(current.y - next.y)
        if (moveDist !== 1) {
            return false
        }

        let moveX = current.x - next.x
        let moveY = current.y - next.y

        if (!creature.placeSpriteOnTile(nextTile.sprite, { randomize: true })) {
            return false
        }

        if (moveX === 0) {
            if (-moveY === 1) {
                creature.sprite.rotation = Math.PI
            } else {
                creature.sprite.rotation = 0
            }
        } else {
            if (-moveX === 1) {
                creature.sprite.rotation = Math.PI / 2
            } else {
                creature.sprite.rotation = Math.PI * 3 / 2
            }
        }

        creature.location = { x: next.x, y: next.y }
        this.syncTrilobiteTileOccupancy(creature, currentTile, nextTile)
        this.markCreatureBfsFieldsDirty(
            creature,
            [currentTile?.key, nextTile?.key].filter((tileKey) => typeof tileKey === 'string')
        )
        return creature.location
    }

    getCoords() {
        return [...this.tiles.keys()];
    }

}

function isInCircle(x, y, cx, cy, r) {
    let dx = x - cx;
    let dy = y - cy;
    return (dx * dx + dy * dy) <= (r * r);
}

function getDistance(x, y, cx, cy) {
    let dx = x - cx;
    let dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy)
}

function randomNormal(mean, stdDev) {
    let u = 1 - Math.random();
    let v = 1 - Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap
    }
    return array;
}
