
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
        this.game = object.game

        this.object = object

        this.anchor = {
            x: this.block.x,
            y: this.block.y
        }

        this.bounds = {
            minX: this.block.position.x + (30 * this.scale),
            minY: this.block.position.y + (30 * this.scale),
            maxX: this.block.position.x + this.block.width - (30 * this.scale),
            maxY: this.block.position.y + this.block.height - (30 * this.scale)
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
        title.x = this.bounds.minX + ((this.bounds.maxX - this.bounds.minX) / 2)
        title.y = this.bounds.minY + (title.height / 2)
        title.zIndex = 1

        let coordsWin = PIXI.Sprite.from('window_5x4')
        coordsWin.scale.set(this.scale * 0.8)
        coordsWin.x = this.bounds.maxX - coordsWin.width - (20 * this.scale)
        coordsWin.y = this.bounds.minY + title.height + (20 * this.scale)
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
        coordsX.x = this.bounds.maxX - coordsWin.width - (5 * this.scale)
        coordsX.y = coordsWin.position.y + (10 * this.scale)
        coordsX.zIndex = 2

        let myY = -this.object.location.y
        
        let coordsY = new PIXI.Text({text: 'y: '+myY,style })
        coordsY.x = this.bounds.maxX - coordsWin.width - (5 * this.scale)
        coordsY.y = coordsWin.position.y + (45 * this.scale)
        coordsY.zIndex = 2

        //shmupdate
        //add "move" button
        //add "build" button
        //add "mine" button
        //set buttonMode true 
        //add hover color change if possible (like a regular button hover+press)

        let moveButton = PIXI.Sprite.from('window_4x1')
        moveButton.x = this.bounds.minX + (10 * this.scale)
        moveButton.y = this.bounds.minY + title.height + (20 * this.scale)
        moveButton.zIndex = 1
        moveButton.scale.set(this.scale * 0.6)
        moveButton.interactive = true
        moveButton.buttonMode = true
        let moveText = new PIXI.Text({text: 'Move',style })
        moveText.x = moveButton.position.x + (15 * this.scale)
        moveText.y = moveButton.position.y + (7 * this.scale)
        moveText.zIndex = 2

        moveButton.on('mouseup',(e) => {
            this.game.movePath = true
        })
        
        let buildButton = PIXI.Sprite.from('window_4x1')
        buildButton.x = this.bounds.minX + (10 * this.scale)
        buildButton.y = moveButton.y + moveButton.height + (10 * this.scale)
        buildButton.zIndex = 1
        buildButton.scale.set(this.scale * 0.6)
        buildButton.interactive = true
        moveButton.buttonMode = true
        let buildText = new PIXI.Text({text: 'Build',style })
        buildText.x = buildButton.position.x + (15 * this.scale)
        buildText.y = buildButton.position.y + (7 * this.scale)
        buildText.zIndex = 2

        buildButton.on('mouseup',(e) => {
            //open buildingOptions menu based on creature 
            //check to see what it can build and throw options together
            //run close and open then buildingOptionsMenu
        })

        let mineButton = PIXI.Sprite.from('window_4x1')
        mineButton.x = this.bounds.minX + (10 * this.scale)
        mineButton.y = buildButton.y + buildButton.height + (10 * this.scale)
        mineButton.zIndex = 1
        mineButton.scale.set(this.scale * 0.6)
        mineButton.interactive = true
        moveButton.buttonMode = true
        let mineText = new PIXI.Text({text: 'Mine',style })
        mineText.x = mineButton.position.x + (15 * this.scale)
        mineText.y = mineButton.position.y + (7 * this.scale)
        mineText.zIndex = 2

        this.container.addChild(title)

        this.container.addChild(coordsWin)
        this.container.addChild(coordsX)
        this.container.addChild(coordsY)

        this.container.addChild(moveButton)
        this.container.addChild(moveText)
        this.container.addChild(buildButton)
        this.container.addChild(buildText)
        this.container.addChild(mineButton)
        this.container.addChild(mineText)
    }

    buildOptionsMenu(creature) {

    }

    buildingMenu() {

    }


}