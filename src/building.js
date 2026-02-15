import * as PIXI from 'pixi.js'
import { Trilobite } from './trilobite'


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
    
    getLocation(){
        return this.location
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

export class MiningPost extends Building {
    constructor(game){
        super('Mining Post', {x:3, y:3}, [[1,1,1],[1,0,1],[1,1,1]],game,true)
        this.sprite = PIXI.Sprite.from('Mining Post')
        this.description = `Units assigned to this post will mine ore and stone in a ${this.getRadius()}-block radius and store it here. Has a capacity of ${this.getCapacity()}.`

        this.capacity = 100
        this.radius = 10
        this.assignments = new Map()
    }
    
    getCapacity() {
        return this.capacity
    }

    getRadius(){
        return this.radius
    }
}

export class Queen extends Building {

    constructor(game, cave) {
        super('Queen',{x:3, y:3},[[1,1,1],[1,0,1],[1,1,1]],game,true)
        this.sprite = PIXI.Sprite.from('Queen')

        this.description = `The one and only Queen of your colony! Protect her at all costs!`

        this.cave = cave;
        this.algae = 0
        this.algaeMax = 20
    }

    spawnTrilo(){
        // select random tile near queen
        let chudTile = this.tileArray[Math.floor(Math.random * this.tileArray.length)]
        while (chudTile.getCoords().x == this.location.x && chudTile.getCoords().y == this.location.y){
            chudTile = this.tileArray[Math.floor(Math.random * this.tileArray.length)]
        }

        // todo: replace placeholder name
        this.cave.spawn(new Trilobite("Quan", {x: chudTile.getCoords().x, y: chudTile.getCoords().y}, this.game), chudTile)
        this.algae = 0;
    }

}

export class AlgaeFarm extends Building {

    constructor(game) {
        super('Algae Farm',{x:2,y:2},[[0,0],[0,0]],game,false)
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
        super("Storage",{x:2,y:2},[[0,0],[0,0]],game,false)
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
        super("Smith",{x:2,y:2},[[0,0],[0,1]],game,true)
        this.sprite = PIXI.Sprite.from('Smith')

        this.description = `A building that allows you to craft new items for your species.`
    }

    //recipes stored here 
    //need to create item object
}