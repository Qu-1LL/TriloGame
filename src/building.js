import { Ore } from './ores.js'

export function toKey(location) {
    return location.x + "," + location.y
}

export function normalizeTileKey(tile) {
    if (tile === null || tile === undefined) {
        return null
    }
    if (typeof tile === 'string') {
        return tile
    }
    if (typeof tile === 'object') {
        if (typeof tile.key === 'string') {
            return tile.key
        }
        if (Number.isFinite(tile.x) && Number.isFinite(tile.y)) {
            return toKey(tile)
        }
    }
    return null
}

export function keyToCoords(key) {
    const [x, y] = key.split(",").map(Number)
    return { x, y }
}

export function squaredDistance(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return (dx * dx) + (dy * dy)
}

export function isMineableType(tileType) {
    if (tileType === 'wall') {
        return true
    }
    for (const ore of Ore.getOres()) {
        if (ore.name === tileType) {
            return true
        }
    }
    return false
}

export class Factory {

    constructor(myClass,game) {
        this.myClass = myClass
        this.game = game

        let temp = new myClass()
        this.name = temp.name
        this.sprite = temp.sprite
        this.openMap = temp.openMap
        this.size = temp.size
        this.description = temp.description
        this.hasStation = temp.hasStation
    }

    build(...args) {
        return new this.myClass(this.game, ...args)
    }

}

export class Building {

    constructor (name,size,openMap,game,station) {
        this.name = name
        this.size = size
        this.openMap = openMap
        this.game = game
        this.tileArray = new Array()
        this.description = ''
        this.sprite = null
        this.hasStation = station
        this.location = {x: null, y: null}
        this.health = 100
        this.maxHealth = this.health
        this.cave = null
    }

    rotateMap() {
        const rotated = [];

        for (let col = 0; col < this.size.x; col++) {
            rotated[col] = [];
            for (let row = this.size.y - 1; row >= 0; row--) {
                rotated[col].push(this.openMap[row][col]);
            }
        }

        this.openMap = rotated

        let temp = this.size.x
        this.size.x = this.size.y
        this.size.y = temp

        return rotated
    }

    setLocation(x,y) {
        this.location.x = x
        this.location.y = y
    } 

    getName() {
        return this.name
    }
    getSize() {
        return this.size
    }
    getMap() {
        return this.size
    }
    getGame() {
        return this.game
    }
    getDescription() {
        return this.description
    }

    getHealth() {
        return this.health
    }

    getMaxHealth() {
        return this.maxHealth
    }

    restoreHealth() {
        this.health = this.getMaxHealth()
        return this.health
    }

    takeDamage(amount, source = null) {
        if (!Number.isFinite(amount) || amount <= 0 || this.health <= 0) {
            return 0
        }

        const applied = Math.min(this.health, amount)
        this.health -= applied

        if (this.health <= 0) {
            this.health = 0
            this.removeFromGame(source)
        }

        return applied
    }

    cleanupBeforeRemoval() {
        return
    }

    removeFromGame(source = null) {
        if (this.cave && typeof this.cave.removeBuilding === 'function') {
            return this.cave.removeBuilding(this, source)
        }

        this.cleanupBeforeRemoval()

        if (this.sprite?.parent) {
            this.sprite.parent.removeChild(this.sprite)
        }

        if (typeof this.sprite?.destroy === 'function') {
            this.sprite.destroy()
        }

        this.tileArray = []
        this.location = { x: null, y: null }
        this.cave = null
        return true
    }

}
