
import * as PIXI from 'pixi.js'
import { Creature } from './creature.js'
import { Building } from './building.js'
import { toCoords } from './cave.js'

export class Menu {

    constructor(app,object,container) {
        this.app = app
        this.block = PIXI.Sprite.from('menu')
        this.scale = app.screen.height / this.block.height
        this.block.scale.set(this.scale)
        this.block.x = app.screen.width - this.block.width
        this.block.y = 0
        this.block.visible = false
        this.block.interactive = true
        this.block.zIndex = 0
        this.container = container
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
        this.container.addChild(this.block)
    }

    close() {
        this.block.visible = false
        this.container.removeChild(this.block)
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

        let title = new PIXI.Text({text: this.object.name+' the '+creatureType, style: style})
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
        
        let coordsX = new PIXI.Text({text: 'x: '+myX,style: style })
        coordsX.x = this.bounds.maxX - coordsWin.width - (5 * this.scale)
        coordsX.y = coordsWin.position.y + (10 * this.scale)
        coordsX.zIndex = 2

        let myY = -this.object.location.y
        
        let coordsY = new PIXI.Text({text: 'y: '+myY,style: style })
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
        let moveText = new PIXI.Text({text: 'Move',style: style })
        moveText.x = moveButton.position.x + (15 * this.scale)
        moveText.y = moveButton.position.y + (7 * this.scale)
        moveText.zIndex = 2

        moveButton.on('mouseup',(e) => {
            this.game.movePath = true
            for (let sprite of this.game.selected.selectedPaths) {
                sprite.parent.removeChild(sprite)
                sprite.destroy()
            }
            this.game.selected.selectedPaths.clear()
        })
        
        let buildButton = PIXI.Sprite.from('window_4x1')
        buildButton.x = this.bounds.minX + (10 * this.scale)
        buildButton.y = moveButton.y + moveButton.height + (10 * this.scale)
        buildButton.zIndex = 1
        buildButton.scale.set(this.scale * 0.6)
        buildButton.interactive = true
        buildButton.buttonMode = true
        let buildText = new PIXI.Text({text: 'Build',style: style })
        buildText.x = buildButton.position.x + (15 * this.scale)
        buildText.y = buildButton.position.y + (7 * this.scale)
        buildText.zIndex = 2

        buildButton.on('mouseup',(e) => {
            this.close()
            this.open()
            this.buildOptionsMenu()
            this.game.movePath = false
        })

        let mineButton = PIXI.Sprite.from('window_4x1')
        mineButton.x = this.bounds.minX + (10 * this.scale)
        mineButton.y = buildButton.y + buildButton.height + (10 * this.scale)
        mineButton.zIndex = 1
        mineButton.scale.set(this.scale * 0.6)
        mineButton.interactive = true
        mineButton.buttonMode = true
        let mineText = new PIXI.Text({text: 'Mine',style: style })
        mineText.x = mineButton.position.x + (15 * this.scale)
        mineText.y = mineButton.position.y + (7 * this.scale)
        mineText.zIndex = 2

        //function should search the creature's four adjacent tiles for 
        //creature doesn't fit + holding building to see if it can do 
        //any actions unique to a building

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

    buildOptionsMenu() {
        let buildings = this.object.getBuildable()

        let style = new PIXI.TextStyle({
            fontFamily: 'Verdana',
            fontSize: 36 * this.scale,
            stroke: '#000000',
            wordWrap: true,
            wordWrapWidth: 440
        });

        let title = new PIXI.Text({text: 'Buildings', style: style})
        title.anchor.set(0.5)
        title.x = this.bounds.minX + ((this.bounds.maxX - this.bounds.minX) / 2)
        title.y = this.bounds.minY + (title.height / 2)
        title.zIndex = 1

        style = new PIXI.TextStyle({
            fontFamily: 'Verdana',
            fontSize: 24 * this.scale,
            stroke: '#000000',
            wordWrap: true,
            wordWrapWidth: 440
        });

        this.container.addChild(title)

        let marginAccumulate = 10 * this.scale

        let hoverContainer = new PIXI.Container()
        hoverContainer.sortableChidlren = true
        this.container.addChild(hoverContainer)
        hoverContainer.zIndex = 1

        for (let building of buildings) {
            let myButton = PIXI.Sprite.from('window_4x1')
            myButton.x = this.bounds.minX + (10 * this.scale)
            myButton.y = this.bounds.minY + title.height + marginAccumulate
            myButton.zIndex = 1
            myButton.scale.set(this.scale * 0.6)
            myButton.interactive = true
            myButton.buttonMode = true
            let myText = new PIXI.Text({text: building.name, style: style})
            myText.x = myButton.position.x + (15 * this.scale)
            myText.y = myButton.position.y + (7 * this.scale)
            myText.zIndex = 2

            this.container.addChild(myButton)
            this.container.addChild(myText)

            myButton.on('pointerover', (event) => {
                if(this.game.buildMode) {
                    return
                }

                let mySprite = PIXI.Sprite.from(building.sprite.texture)
                mySprite.x = this.bounds.minX + ((this.bounds.maxX - this.bounds.minX) / 2) + (10 * this.scale)
                mySprite.y = this.bounds.minY + title.height + (10 * this.scale)
                mySprite.zIndex = 1
                mySprite.scale.set((this.bounds.maxX - mySprite.x) / mySprite.width)
                
                let infoStyle = new PIXI.TextStyle({
                    fontFamily: 'Courier New',
                    fontSize: 20 * this.scale,
                    stroke: '#000000',
                    wordWrap: true,
                    wordWrapWidth: 200,//this.bounds.maxX - mySprite.x,
                    padding: 0,
                    align: 'center'
                });

                let myInfo = new PIXI.Text({
                    text: building.size.x+" x "+ building.size.y+"\n"+building.description,
                    style: infoStyle
                })

                myInfo.x = mySprite.x
                myInfo.y = mySprite.y + mySprite.height + (10 * this.scale)
                myInfo.zIndex = 1

                hoverContainer.addChild(mySprite)
                hoverContainer.addChild(myInfo)
            })
            myButton.on("pointerout", (event) => {
                if(this.game.buildMode) {
                    return
                }

                for(let child of [...hoverContainer.children]) {
                    child.parent.removeChild(child)
                    child.destroy()
                }
            })
            myButton.on('mouseup', (event) => {
                this.game.buildMode = true
                this.game.floatingBuilding.building = building.build()
                this.game.floatingBuilding.sprite = this.game.floatingBuilding.building.sprite

                this.game.tileContainer.addChild(this.game.floatingBuilding.sprite)
                this.game.floatingBuilding.sprite.zIndex = 5

                let rect = this.game.app.canvas.getBoundingClientRect();
                let pos = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };
                this.game.floatingBuilding.sprite.x = pos.x - rect.left
                this.game.floatingBuilding.sprite.y = pos.y - rect.top
                this.game.floatingBuilding.sprite.baseX = pos.x - rect.left
                this.game.floatingBuilding.sprite.baseY = pos.y - rect.top
                this.game.floatingBuilding.sprite.scale.set(this.game.currentScale)
                this.game.floatingBuilding.sprite.anchor.set(0.25, 0.25)
            })

            marginAccumulate += (myButton.height + (10 * this.scale))
        }
    }

    buildingMenu() {

    }


}