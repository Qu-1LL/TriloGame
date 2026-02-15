

export class Tile {
    constructor(key) {
        this.key = key;
        this.holding = new Map();
        this.holding.set('base', 'empty')
        this.holding.set('built',null)
        this.creatureCanFit = true
        this.adjacent = new Set();
        this.sprite = null
    }

    addNeighbor(Tile) {
        this.adjacent.add(Tile);
        Tile.adjacent.add(this)
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

    getBuilt() {
        return this.holding.get('built')
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
        this.tiles = new Map(); // key -> Tile
    }

    addTile(key) {
        if (!this.tiles.has(key)) {
            this.tiles.set(key, new Tile(key));
        }
        return this.tiles.get(key);
    }

    removeTile(key) {
        let deleted = this.tiles.get(key)
        if (deleted) {
            for(let n of deleted.getNeighbors()) {
                n.removeNeighbor(deleted)
            }
            this.tiles.delete(key)
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

    getTile(key) {
        return this.tiles.get(key);
    }

    getTiles() {
        return [...this.tiles.values()];
    }

}
