
import {Graph, Tile } from './graph-data.js'
import { Ore } from './ores.js'

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

    constructor () {
        super()
        while( this.tiles.size < 28000) {
            this.tiles = new Map();
            this.#generateCave();
        }
        console.log("total tiles: "+this.tiles.size)
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
            console.log(ore.name+" spawned "+count+" veins / "+ Math.ceil(((cavernCount / 5) + (cavernCount * radius * (Ore.getOres().length - oreCount)) / oreMult)))
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