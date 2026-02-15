
import { Creature } from './creature.js'
import * as PIXI from 'pixi.js'

export class Trilobite extends Creature {

    constructor(name, location, game) {
        super(name, location, PIXI.Sprite.from('Trilobite'), game)

    }

    
}