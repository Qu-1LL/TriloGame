import * as PIXI from 'pixi.js'
import { Building } from '../building.js'

export class Barracks extends Building {

    constructor(game) {
        super('Barracks', {x:3, y:3}, [[1,1,1],[1,0,1],[1,1,1]],game, true)
        this.sprite = PIXI.Sprite.from('Barracks')
        this.description = 'Fighters will wait here until danger arises.'
        this.recipe = {
            Sandstone: 20
        }

        this.assignments = new Set()
    }

    getAssignments () {
        return this.assignments
    }

    getVolume() {
        return this.assignments.size
    }

    assign(creature) {
        this.assignments.add(creature)
    }

    removeAssignment(creature) {
        this.assignments.delete(creature)
    }

}
