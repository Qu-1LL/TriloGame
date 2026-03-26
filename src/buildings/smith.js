import * as PIXI from 'pixi.js'
import { Building } from '../building.js'

export class Smith extends Building {

    constructor (game) {
        super("Smith",{x:2,y:2},[[0,0],[0,1]],game,true)
        this.sprite = PIXI.Sprite.from('Smith')
        this.recipe = {
            Sandstone: 20
        }

        this.description = `A building that allows you to craft new items for your species.`
    }

    //recipes stored here 
    //need to create item object
}
