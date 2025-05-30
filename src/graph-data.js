

export class Tile {
    constructor(value) {
        this.value = value;
        this.holding = new Map();
        this.holding.set('base', 'empty')
        this.holding.set('built','none')
        this.creatureCanFit = true
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

    getBase() {
        return this.holding.get('base')
    }

    setBase(myBase) {
        this.holding.set('base', myBase)
    } 

    setBuilt(building) {
        this.holding.set('built',building)
    }

    creatureFits() {
        return this.creatureCanFit
    }

    canBuild() {
        return this.holding.get('base') == 'empty' && this.holding.get('built') == 'none'
    }

    getRandomNeighbor() {
        let myNum = Math.floor(Math.random() * this.adjacent.size)
        let count = 0
        for (let n of this.adjacent) {
            if (count == myNum) {
                return n
            }
            count++
        }
    }
}

export class Graph {
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