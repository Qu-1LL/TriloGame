
import * as PIXI from 'pixi.js'
import { Creature } from './creature.js'
import { Building } from './building.js'
import { toCoords } from './cave.js'

export class Menu {

    constructor(app,object,container) {
        this.block = PIXI.Sprite.from('menu')
        this.scale = app.screen.height / this.block.height
        this.block.scale.set(this.scale)
        this.block.x = app.screen.width - this.block.width
        this.block.y = 0
        this.block.visible = false
        this.block.zIndex = 0
        this.container = container
        this.container.addChild(this.block)

        this.object = object

        this.anchor = {
            x: this.block.x,
            y: this.block.y
        }

        if (object instanceof Creature) {
            this.creatureMenu()
        }
        if (object instanceof Building) {
            this.buildingMenu()
        }
    }

    open() {
        this.block.visible = true
    }

    close() {
        this.block.visible = false
        for (let sprite of [...this.container.children]) {
            this.container.removeChild(sprite)
            sprite.visible = false
            sprite.destroy()
        }
    }

    creatureMenu() {

        let bounds = {
            minX: this.block.position.x + (30 * this.scale),
            minY: this.block.position.y + (30 * this.scale),
            maxX: this.block.position.x + this.block.width - (30 * this.scale),
            maxY: this.block.position.y + this.block.height - (30 * this.scale)
        } 

        let style = new PIXI.TextStyle({
            fontFamily: 'Verdana',
            fontSize: 36 * this.scale,
            stroke: '#000000',
            wordWrap: true,
            wordWrapWidth: 440
        });

        //shmupdate: grab creature type from creature object
        let creatureType = 'Trilo'

        let title = new PIXI.Text({text: this.object.name+' the '+creatureType, style})
        title.anchor.set(0.5)
        title.x = bounds.minX + ((bounds.maxX - bounds.minX) / 2)
        title.y = bounds.minY + (title.height / 2)
        title.zIndex = 1

        let coordsWin = PIXI.Sprite.from('window_5x4')
        coordsWin.scale.set(this.scale * 0.8)
        coordsWin.x = bounds.maxX - coordsWin.width
        coordsWin.y = bounds.minY + title.height + (10 * this.scale)
        coordsWin.zIndex = 1

        style = new PIXI.TextStyle({
            fontFamily: 'Verdana',
            fontSize: 24 * this.scale,
            stroke: '#000000',
            wordWrap: true,
            wordWrapWidth: 440
        });

        let myX = this.object.location.x
        
        let coordsX = new PIXI.Text({text: 'x: '+myX,style })
        coordsX.x = bounds.maxX - coordsWin.width + (20 * this.scale)
        coordsX.y = coordsWin.position.y + (10 * this.scale)
        coordsX.zIndex = 2

        let myY = -this.object.location.y
        
        let coordsY = new PIXI.Text({text: 'y: '+myY,style })
        coordsY.x = bounds.maxX - coordsWin.width + (20 * this.scale)
        coordsY.y = coordsWin.position.y + (45 * this.scale)
        coordsY.zIndex = 2

        //shmupdate
        //add "move" button
        //add "build" button
        //set buttonMode true 
        //add hover color change if possible

        this.container.addChild(title)
        this.container.addChild(coordsWin)
        this.container.addChild(coordsX)
        this.container.addChild(coordsY)
    }

    buildingMenu() {

    }


}