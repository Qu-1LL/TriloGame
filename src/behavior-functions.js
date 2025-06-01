
import * as PIXI from 'pixi.js'
import { Cave, toCoords } from './map.js'

export function whenWallMined (interactionEvent, myTile, cave, tileContainer, emptyCoords, dragging, currentScale)  {

        myTile.on("mouseup", () => {
            return
        })

        myTile.texture = PIXI.Texture.from('empty')
        let newEmpty = cave.getTile(emptyCoords)
        console.log("tile clicked: ")
        console.log(emptyCoords)
        console.log(newEmpty)
        newEmpty.setBase('empty')
  
        let myDelts = new Map();
        myDelts.set('n',{x:0,y:-1})
        myDelts.set('s',{x:0,y:1})
        myDelts.set('e',{x:1,y:0})
        myDelts.set('w',{x:-1,y:0})
        let myCoords = toCoords(emptyCoords)
        for (let n of cave.getTile(emptyCoords).getNeighbors()) {
            let nCoords = toCoords(n.value)
            if (nCoords.x - myCoords.x == 1 ) {
                myDelts.delete('e')
            } else if (nCoords.x - myCoords.x == -1) {
                myDelts.delete('w')
            } else if (nCoords.y - myCoords.y == -1) {
                myDelts.delete('n')
            } else {
                myDelts.delete('s')
            }
        }
        for (let dir of myDelts.values()) {
            let newCoords = (myCoords.x + dir.x) + "," + (myCoords.y + dir.y)
            let wallTile = cave.addTile(newCoords)
            console.log("tile added: ")
            console.log(wallTile)
            wallTile.setBase('wall')

            let newDelts = new Map();
            newDelts.set('n',{x:0,y:-1})
            newDelts.set('s',{x:0,y:1})
            newDelts.set('e',{x:1,y:0})
            newDelts.set('w',{x:-1,y:0})

            let wallCoords = toCoords(newCoords)
            console.log("new wall: ")
            console.log(wallCoords)
            for (let d of newDelts.values()) {
                let newN = cave.getTile((wallCoords.x + d.x) + "," + (wallCoords.y + d.y))
                
                if (newN != undefined) {
                    console.log("new neighbor: ")
                    console.log(newN)
                    wallTile.addNeighbor(newN)
                    newN.addNeighbor(wallTile)
                }
            }

            let newTile = Sprite.from('wall')
            newTile.x = interactionEvent.currentTarget.x + (dir.x * 80 * currentScale)
            newTile.y = interactionEvent.currentTarget.y + (dir.y * 80 * currentScale)
            newTile.baseX = interactionEvent.currentTarget.baseX + (dir.x * 80)
            newTile.baseY = interactionEvent.currentTarget.baseY + (dir.y * 80)

            newTile.anchor.set(0.5)
            newTile.interactive = true;
            newTile.buttonMode = true;

            newTile.scale.set(currentScale)

            tileContainer.addChild(newTile)

            newTile.on("mouseup", (interactionEvent) => {
                if (!dragging) {
                    whenWallMined(interactionEvent, newTile, cave, tileContainer,newCoords)
                }
            })
        }
    }