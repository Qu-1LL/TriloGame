import * as PIXI from 'pixi.js'

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
    }

    build(...args) {
        return new this.myClass(this.game, ...args)
    }

}

export class Building {

    constructor (name,size,openMap,game) {
        this.name = name
        this.size = size
        this.openMap = openMap
        this.game = game
        this.tileArray = new Array()
        this.description = ''
        this.sprite = null
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

}

export class AlgaeFarm extends Building {

    constructor(game) {
        super('Algae Farm',{x:2,y:2},[[0,0],[0,0]],game)
        this.sprite = PIXI.Sprite.from('Algae Farm')

        this.rate = 2
        this.capacity = 20

        this.description = `A farm for you to produce algae automatically! Generates ${this.getRate()} algae per turn with a capacity of ${this.getCapacity()}.`
    }

    getRate() {
        return this.rate
    }
    getCapacity() {
        return this.capacity
    }

}

export class Storage extends Building {

    constructor (game) {
        super("Storage",{x:2,y:2},[[0,0],[0,0]],game)
        this.sprite = PIXI.Sprite.from('Storage')

        this.capacity = 20

        this.description = `A container that can hold up to ${this.getCapacity()} items.`
    }

    getCapacity() {
        return this.capacity
    }
}

export class Smith extends Building {

    constructor (game) {
        super("Smith",{x:2,y:2},[[0,0],[0,1]],game)
        this.sprite = PIXI.Sprite.from('Smith')

        this.description = `A building that allows you to craft new items for your species.`
    }

    //recipes stored here 
    //need to create item object
}