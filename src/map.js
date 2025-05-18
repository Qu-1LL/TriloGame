
const degradeMult = 12
const holeLimit = 10
const degradeLimit = 3
const degradeDeviation = 0.7
const cavernCount = 100
const radius = 20

//these params seem perfect
//radius 15-50



class Tile {
    constructor(value,holding={base: 'empty'}) {
        this.value = value;
        this.holding = holding;
        this.adjacent = new Set();
    }


    addNeighbor(Tile) {
        this.adjacent.add(Tile);
    }

    removeNeighbor(Tile) {
        this.adjacent.delete(Tile);
    }

    getNeighbors() {
        return this.adjacent
    }
}

class Graph {
    constructor() {
        this.tiles = new Map(); // value -> Tile
    }

    addTile(value) {
        if (!this.tiles.has(value)) {
            this.tiles.set(value, new Tile(value));
        }
        return this.tiles.get(value);
    }

    removeTile(value) {
        let deleted = this.tiles.get(value)
        if (deleted) {
            for(let n of deleted.getNeighbors()) {
                n.removeNeighbor(deleted)
            }
            this.tiles.delete(value)
            return deleted;
        } else {
            return null;
        }
    }

    addEdge(value1, value2) {
        const v1 = this.addTile(value1);
        const v2 = this.addTile(value2);
        v1.addNeighbor(v2);
        v2.addNeighbor(v1); 
    }

    getTile(value) {
        return this.tiles.get(value);
    }

    getTiles() {
        return [...this.tiles.values()];
    }
}


export class Cave extends Graph {

    constructor () {
        super()
        this.#generateCave();
          
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
            if (this.getTile(myValues[i]).getNeighbors().size == 4) {
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


    static toCoords(coords) {
        let [x, y] = coords.split(",").map(Number)
        return {x: x, y: y}
    }

    getCoords() {
        return [...this.tiles.keys()];
    }

}

function isInCircle(x, y, cx, cy, r) {
    const dx = x - cx;
    const dy = y - cy;
    return (dx * dx + dy * dy) <= (r * r);
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