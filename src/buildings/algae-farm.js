import * as PIXI from 'pixi.js'
import { Building, keyToCoords, normalizeTileKey, squaredDistance, toKey } from '../building.js'

export class AlgaeFarm extends Building {

    constructor(game) {
        super('Algae Farm',{x:2,y:3},[[1,1],[1,1],[1,1]],game,false)
        this.sprite = PIXI.Sprite.from('Algae Farm')

        this.period = 30
        this.growth = 0
        this.harvestYield = 5
        this.assignments = new Set()
        this.recipe = {
            Sandstone: 20
        }

        this.description = `A passable algae farm. Worker trilobites harvest ${this.getHarvestYield()} algae when random < growth/period.`
    }

    getPeriod() {
        return this.period
    }

    getGrowth() {
        return this.growth
    }

    getHarvestYield() {
        return this.harvestYield
    }

    assign(creature) {
        if (!creature) {
            return false
        }
        this.assignments.add(creature)
        return true
    }

    removeAssignment(creature) {
        this.assignments.delete(creature)
    }

    getVolume() {
        return this.assignments.size
    }

    getPassableTileMap() {
        const tileMap = new Map()
        for (const tile of this.tileArray) {
            if (!tile || !tile.creatureFits()) {
                continue
            }
            tileMap.set(tile.key, tile)
        }
        return tileMap
    }

    isLocationOnFarm(location) {
        const locationKey = normalizeTileKey(location)
        if (!locationKey) {
            return false
        }

        const tile = this.getPassableTileMap().get(locationKey)
        return tile !== undefined
    }

    getApproachTile(startLocation) {
        const passableTiles = [...this.getPassableTileMap().values()]
        if (passableTiles.length === 0) {
            return null
        }

        let origin = keyToCoords(passableTiles[0].key)
        if (Number.isFinite(startLocation?.x) && Number.isFinite(startLocation?.y)) {
            origin = startLocation
        }

        let bestTile = passableTiles[0]
        let bestDist = squaredDistance(origin, keyToCoords(bestTile.key))

        for (const tile of passableTiles) {
            const dist = squaredDistance(origin, keyToCoords(tile.key))
            if (dist < bestDist) {
                bestDist = dist
                bestTile = tile
            }
        }

        return keyToCoords(bestTile.key)
    }

    findFarmPath(startKey, goalKey, passableTileMap) {
        if (!startKey || !goalKey || !passableTileMap.has(startKey) || !passableTileMap.has(goalKey)) {
            return null
        }

        if (startKey === goalKey) {
            return [startKey]
        }

        const queue = [startKey]
        let queueHead = 0
        const visited = new Set([startKey])
        const cameFrom = new Map()

        while (queueHead < queue.length) {
            const currentKey = queue[queueHead]
            queueHead++

            if (currentKey === goalKey) {
                const path = []
                let key = goalKey
                while (key !== undefined) {
                    path.push(key)
                    key = cameFrom.get(key)
                }
                path.reverse()
                return path
            }

            const currentTile = passableTileMap.get(currentKey)
            for (const neighbor of currentTile.getNeighbors()) {
                if (!passableTileMap.has(neighbor.key) || visited.has(neighbor.key)) {
                    continue
                }
                visited.add(neighbor.key)
                cameFrom.set(neighbor.key, currentKey)
                queue.push(neighbor.key)
            }
        }

        return null
    }

    findNextUnvisitedKey(currentKey, unvisitedKeys, passableTileMap) {
        let bestKey = null
        let bestLength = Infinity

        for (const candidateKey of unvisitedKeys) {
            const candidatePath = this.findFarmPath(currentKey, candidateKey, passableTileMap)
            if (!candidatePath) {
                continue
            }

            if (candidatePath.length < bestLength) {
                bestLength = candidatePath.length
                bestKey = candidateKey
            }
        }

        return bestKey
    }

    getPath(currentPositionOnFarm) {
        const passableTileMap = this.getPassableTileMap()
        if (passableTileMap.size === 0) {
            return []
        }

        let originKey = normalizeTileKey(currentPositionOnFarm)
        if (!originKey || !passableTileMap.has(originKey)) {
            const approachTile = this.getApproachTile(currentPositionOnFarm)
            originKey = approachTile ? toKey(approachTile) : [...passableTileMap.keys()][0]
        }

        const route = [originKey]
        const unvisited = new Set(passableTileMap.keys())
        unvisited.delete(originKey)
        let currentKey = originKey

        while (unvisited.size > 0) {
            const nextKey = this.findNextUnvisitedKey(currentKey, unvisited, passableTileMap)
            if (!nextKey) {
                break
            }

            const segment = this.findFarmPath(currentKey, nextKey, passableTileMap)
            if (!segment || segment.length < 2) {
                unvisited.delete(nextKey)
                continue
            }

            for (let i = 1; i < segment.length; i++) {
                route.push(segment[i])
                unvisited.delete(segment[i])
            }

            currentKey = route[route.length - 1]
        }

        if (currentKey !== originKey) {
            const returnPath = this.findFarmPath(currentKey, originKey, passableTileMap)
            if (returnPath && returnPath.length > 1) {
                for (let i = 1; i < returnPath.length; i++) {
                    route.push(returnPath[i])
                }
            }
        }

        return route.map((key) => keyToCoords(key))
    }

    tryHarvest(creature) {
        if (!creature || typeof creature.addToInventory !== 'function') {
            return false
        }

        this.growth++
        const harvestChance = this.growth / this.period
        if (Math.random() >= harvestChance) {
            return false
        }

        const harvested = creature.addToInventory('Algae', this.harvestYield)
        if (harvested !== this.harvestYield) {
            return false
        }

        this.growth = 0
        return true
    }
}
