import * as PIXI from 'pixi.js'
import { Creature } from './creature.js'

export class Enemy extends Creature {

    constructor(name, location, game, sprite = new PIXI.Sprite()) {
        super(name, location, sprite, game)
        this.assignment = 'enemy'
    }

    getBehavior() {
        return this.idleBehavior
    }

    idleBehavior = () => {
        return false
    }

}
