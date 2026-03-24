import * as PIXI from 'pixi.js'
import { Building } from '../building.js'

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
