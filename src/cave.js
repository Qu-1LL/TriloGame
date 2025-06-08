
import * as PIXI from 'pixi.js'
import {Graph, Tile } from './graph-data.js'
import { Ore } from './ores.js'

import { Game } from './game.js'

const degradeMult = 12
const holeLimit = 10
const degradeLimit = 3
const degradeDeviation = 0.7
const cavernCount = 100
const radius = 20
const oreMult = 300
const oreDist = 10


export function toCoords(coords) {
    let [x, y] = coords.split(",").map(Number)
    return {x: x, y: y}
}


export class Cave extends Graph {

    constructor (app, game) {
        super()
        while( this.tiles.size < 28000) {
            this.tiles = new Map();
            this.#generateCave();
        }
        this.creatures = new Set();
        this.buildings = new Set();
        this.app = app
        this.game = game

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
    
            this.game.tileContainer.addChild(myTile)
    
            myTile.interactive = true;
            myTile.buttonMode = true;
        }
    }

    #generateCave() {
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
        
        for (let i = 0; i < 2 + (radius / degradeMult) + (radius / cavernCount) ; i++) {
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

        let oreCount = 0;
        for(let ore of Ore.getOres()) {
            let count = 0
            for (let tile of shuffleArray(this.getTiles())) {

                let myLower = Math.abs(randomNormal( 3 * cavernCount * oreCount ,cavernCount * (Ore.getOres().length - oreCount)) / oreDist)
                let myUpper = Math.abs(randomNormal( 3 * cavernCount * (oreCount + 3),2 * cavernCount * (Ore.getOres().length - oreCount)) / oreDist)
                let myCoords = toCoords(tile.value)
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
        for(let x = 0; x < building.size.x; x++) {
            for (let y = 0; y < building.size.y; y++) {
                let theseCoords = (location.x + x) + "," + (location.y + y)
                let curTile = this.tiles.get(theseCoords)
                if (curTile.getBuilt() !== 'none' || curTile.getBase() !== 'empty' || !curTile.creatureFits()) {
                    return false
                }
            }
        }
        return true
    }

    build(building,location,sprite) {
        if (!this.canBuild(building,location)) {
            return
        }
        this.buildings.add(building)
        //still needs to check if a building isn't overlapping
        for(let x = 0; x < building.size.x; x++) {
            for (let y = 0; y < building.size.y; y++) {
                let theseCoords = (location.x + x) + "," + (location.y + y)
                let curTile = this.tiles.get(theseCoords)
                building.tileArray.push(curTile)
                if (building.openMap[y][x] > 1) {
                    continue
                }
                curTile.setBuilt(building)
                curTile.creatureCanFit = (building.openMap[y][x] === 1)
            }
        }

        sprite.anchor.set(0.5)
        sprite.scale.set
        sprite.x = (this.game.midx) + (80 * location.x * this.game.currentScale) + (sprite.width / 2 * this.game.currentScale) - 40
        sprite.y = (this.game.midy) + (80 * location.y * this.game.currentScale) + (sprite.height / 2 * this.game.currentScale) - 40
        sprite.baseX = (this.game.midx) + (80 * location.x) + (sprite.width / 2) - 40
        sprite.baseY = (this.game.midy) + (80 * location.y) + (sprite.height / 2) - 40
        sprite.interactive = true;
        sprite.buttonMode = true;
        sprite.zIndex = 1

        sprite.on('pointermove', (event) => {
            let pos = event.data.global;

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('pointerover', event);
                    break;
                }
            }
        });

        sprite.on('mouseup', (event) => {
            let pos = event.data.global;

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('mouseup', event);
                    break;
                }
            }
        });

        sprite.on('pointerout', (event) => {
            let pos = event.data.global;

            for (let tile of building.tileArray) {
                let bounds = tile.sprite.getBounds()
                if (bounds.minX < pos.x && bounds.maxX > pos.x && bounds.minY < pos.y && bounds.maxY > pos.y) {
                    tile.sprite.emit('pointerout', event);
                    break;
                }
            }
        });

        this.game.tileContainer.addChild(sprite)
    }

    spawn(creature,tile) {

        if (tile.getBase() == 'wall' || !tile.creatureFits()) {
            return
        }

        creature.sprite.anchor.set(0.5)
        creature.sprite.x = (this.game.midx) + (80 * creature.location.x * this.game.currentScale)
        creature.sprite.y = (this.game.midy) + (80 * creature.location.y * this.game.currentScale)
        creature.sprite.baseX = (this.game.midx) + (80 * creature.location.x) 
        creature.sprite.baseY = (this.game.midy) + (80 * creature.location.y)
        creature.sprite.interactive = true;
        creature.sprite.buttonMode = true;
        creature.sprite.zIndex = 2

        this.game.tileContainer.addChild(creature.sprite)

        this.creatures.add(creature)
    }

    bfsPath(startKey, goalKey) {

        const queue = [startKey];
        const visited = new Set([startKey]);
        const cameFrom = new Map();

        let timeCount = 0

        while (queue.length > 0 && timeCount < 7850) {

            const currentKey = queue.shift();

            if (currentKey === goalKey) {
                let path = [];
                let k = goalKey;
                while (k !== undefined) {
                    path.push(k);
                    k = cameFrom.get(k);
                }
                path.reverse();
                return path
            }

            for (let n of this.getTile(currentKey).getNeighbors()) {

                if (!visited.has(n.value)) {
                    timeCount++
                    if (n.creatureCanFit) {
                        queue.push(n.value);
                        visited.add(n.value);
                        cameFrom.set(n.value, currentKey);
                    }
                }
            }
        }

        return null;
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