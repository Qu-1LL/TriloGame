
import { NodeQueue } from './queue-data.js'
import { Game } from './game.js'

export class Creature {
    constructor(name,location,sprite,game) {
        this.name = name
        this.queue = new NodeQueue()
        this.location = location
        this.sprite = sprite
        this.game = game

        sprite.on('mouseup', (interactionEvent) => {
            if (this.game.selected.object === this) {
                this.game.selected.setSelected(null)
                return
            }

            if (this.game.selected.object) {
                this.game.selected.setSelected(null)
            }
            this.game.selected.setSelected(this)
        })
    }

    move() {

        let next = this.queue.peek()

        //shmupdate: if creature can successfully do next

        next = this.queue.dequeue()

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
}