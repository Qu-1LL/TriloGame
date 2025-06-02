
import { NodeQueue } from './queue-data.js'

export class Creature {
    constructor(name,location,sprite,selectedCreature) {
        this.name = name
        this.queue = new NodeQueue()
        this.location = location
        this.sprite = sprite

        sprite.on('mouseup', (interactionEvent) => {
            if (selectedCreature.creature) {
                selectedCreature.setCreature(null)
                return
            }
            selectedCreature.setCreature(this)
        })
    }

    move(currentScale) {

        let next = this.queue.peek()

        //if creature can successfully do next

        next = this.queue.dequeue()

        if (next === null) {
            return null
        } else {

            let moveX = this.location.x - next.x
            let moveY = this.location.y - next.y

            this.sprite.x = this.sprite.x + (80 * currentScale * -moveX)
            this.sprite.y = this.sprite.y + (80 * currentScale * -moveY)

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