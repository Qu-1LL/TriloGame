
import { NodeQueue } from './queue-data.js'
import { Game } from './game.js'
import { toCoords, toKey } from './cave.js'

export class Creature {
    constructor(name,location,sprite,game) {
        this.name = name
        this.queue = new NodeQueue()
        this.location = location
        this.sprite = sprite
        this.game = game
        this.cave = null

        sprite.on('mouseup', (interactionEvent) => {
            if (this.game.buildMode) {
                return
            }
            
            if (this.game.selected.object === this) {
                this.game.selected.setSelected(null)
                return
            }

            if (this.game.selected.object) {
                this.game.selected.setSelected(null)
            }
            this.game.selected.setSelected(this)
            this.game.movePath = false
        })
    }

    move() {

        let myPath = this.cave.bfsPath(toKey(this.location),toKey(this.queue.getRear()))
        this.queue.clear()

        if(!myPath) {
            return null
        } 
        
        //warn user that path was interrupted if it returns null

        myPath.shift()
        for (let i = 0; i < myPath.length; i++) {
            this.queue.enqueue(myPath[i])
        }

        let next = this.queue.dequeue()

        if (next === null) {
            return null
        } else {

            let moveX = this.location.x - next.x
            let moveY = this.location.y - next.y

            this.sprite.x = this.sprite.x + (80 * this.game.currentScale * -moveX)
            this.sprite.y = this.sprite.y + (80 * this.game.currentScale * -moveY)

            this.sprite.baseX = this.sprite.baseX + (80 * -moveX)
            this.sprite.baseY = this.sprite.baseY + (80 * -moveY)

            if (moveX === 0) {
                if (-moveY === 1) {
                    this.sprite.rotation = Math.PI
                } else {
                    this.sprite.rotation = 0
                }
            } else {
                if (-moveX === 1) {
                    this.sprite.rotation = Math.PI / 2
                } else {
                    this.sprite.rotation = Math.PI * 3 / 2
                }
            }

            this.location = next
            return next
        }
    }

    getActions() {
        let myTile = this.cave.getTile(toKey(this.location))
        let myNeighbors = [ ...myTile.getNeighbors()]

        var myActions = new Set()

        if (myTile.getBuilt()) {
            let myBuilding = myTile.getBuilt()
            if (myBuilding.hasStation) {
                myActions.add(myBuilding)
            }
        } 

        for (let n of myNeighbors) {
            if (n.getBuilt()) {
                if (!n.getBuilt().hasStation) {
                    myActions.add(n.getBuilt())
                }
            }
        }

        return myActions
    }

    getBuildable() {
        let myBuildings = [...this.game.unlockedBuildings]
        //if creature can build special buildings, add those here
        return myBuildings
    }
}