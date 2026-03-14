
import { Creature } from './creature.js'
import * as PIXI from 'pixi.js'
import { MiningPost } from './building.js'
import { Ore } from './ores.js'
import { toCoords } from './cave.js'

function isMineableBase(base) {
    if (base === 'wall') {
        return true
    }
    for (const ore of Ore.getOres()) {
        if (ore.name === base) {
            return true
        }
    }
    return false
}

function squaredDistance(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return (dx * dx) + (dy * dy)
}

export class Trilobite extends Creature {

    constructor(name, location, game) {
        super(name, location, PIXI.Sprite.from('Trilobite'), game)
        this.miningPost = null
        this.pendingMineTileKey = null

    }

    getBehavior() {
        if (this.assignment == "miner") {
            return this.minerBehavior
        } else {
            return this.unassignedBehavior
        }
    }

    unassignedBehavior = () => {
        this.releaseMiningPost()
        return false
    }

    minerBehavior = () => {
        return this.enqueueAction(() => this.minerStep1())
    }

    isMiner() {
        return this.assignment === "miner"
    }

    ensureMinerState() {
        if (this.isMiner()) {
            return true
        }

        this.releaseMiningPost()
        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.minerBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    getMiningPosts() {
        if (!this.cave) {
            return []
        }

        const posts = []
        for (const building of this.cave.buildings) {
            if (building instanceof MiningPost) {
                posts.push(building)
            }
        }
        return posts
    }

    setMiningPost(post) {
        if (this.miningPost && this.miningPost !== post) {
            if (this.pendingMineTileKey) {
                this.miningPost.invalidateMineableQueues()
                this.pendingMineTileKey = null
            }
            this.miningPost.removeAssignment(this)
        }
        this.miningPost = post
    }

    resetPendingMineTarget(requeue = false) {
        if (requeue && this.miningPost && this.pendingMineTileKey) {
            this.miningPost.invalidateMineableQueues()
        }
        if (this.miningPost) {
            this.miningPost.assign(this, null)
        }
        this.pendingMineTileKey = null
    }

    releaseMiningPost() {
        if (this.miningPost && this.pendingMineTileKey) {
            this.miningPost.invalidateMineableQueues()
        }
        if (this.miningPost) {
            this.miningPost.removeAssignment(this)
        }
        this.miningPost = null
        this.pendingMineTileKey = null
    }

    getMiningPostPriorityList() {
        const viablePosts = this.getMiningPosts().filter(
            (post) => post.getInventorySpace() > 0 && post.hasQueuedMineableTiles(this.cave)
        )
        if (viablePosts.length === 0) {
            return []
        }

        return [...viablePosts].sort((a, b) => {
            const loadDiff = a.getVolume() - b.getVolume()
            if (loadDiff !== 0) {
                return loadDiff
            }

            const aApproach = a.getApproachTile(this.cave, this.location)
            const bApproach = b.getApproachTile(this.cave, this.location)
            if (!aApproach && !bApproach) {
                return 0
            }
            if (!aApproach) {
                return 1
            }
            if (!bApproach) {
                return -1
            }

            return squaredDistance(this.location, aApproach) - squaredDistance(this.location, bApproach)
        })
    }

    tryNavigateMiningPosts = (orderedPosts, index = 0) => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!orderedPosts || index >= orderedPosts.length) {
            this.releaseMiningPost()
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const post = orderedPosts[index]
        this.setMiningPost(post)
        post.assign(this, null)

        if (post.isLocationInArea(this.location)) {
            return this.minerStep2()
        }

        const approachTile = post.getApproachTile(this.cave, this.location)
        if (!approachTile) {
            post.removeAssignment(this)
            return this.tryNavigateMiningPosts(orderedPosts, index + 1)
        }

        const navFallback = () => {
            post.removeAssignment(this)
            return this.tryNavigateMiningPosts(orderedPosts, index + 1)
        }

        if (!this.navigateTo(approachTile, navFallback)) {
            post.removeAssignment(this)
            return this.tryNavigateMiningPosts(orderedPosts, index + 1)
        }

        this.enqueueAction(() => this.minerStep2())
        return true
    }

    minerStep1 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        const orderedPosts = this.getMiningPostPriorityList()
        if (orderedPosts.length === 0) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        return this.tryNavigateMiningPosts(orderedPosts, 0)
    }

    minerStep2 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.miningPost) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        if (this.hasInventory()) {
            if (!this.miningPost.isLocationOnPost(this.location)) {
                const approachTile = this.miningPost.getApproachTile(this.cave, this.location)
                if (!approachTile) {
                    this.releaseMiningPost()
                    this.enqueueAction(() => this.minerStep1())
                    return false
                }

                const navFallback = () => {
                    this.releaseMiningPost()
                    return this.minerStep1()
                }
                if (!this.navigateTo(approachTile, navFallback)) {
                    return false
                }

                this.enqueueAction(() => this.minerStep2())
                return true
            }

            const accepted = this.miningPost.deposit(this.inventory.type, this.inventory.amount)
            this.removeFromInventory(accepted)

            if (this.hasInventory()) {
                this.enqueueAction(() => this.minerStep1())
                return false
            }
        }

        if (!this.isMiner()) {
            const fallbackBehavior = this.getBehavior()
            if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.minerBehavior) {
                fallbackBehavior.call(this)
            }
            return false
        }

        return this.minerStep3()
    }

    minerStep3 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.miningPost) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const targetTile = this.miningPost.grabMineableTile(this.cave, this)
        if (!targetTile) {
            this.miningPost.assign(this, null)
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        this.pendingMineTileKey = targetTile.key
        return this.minerStep4()
    }

    minerStep4 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.miningPost || !this.pendingMineTileKey) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        if (this.miningPost.getAssignment(this) !== this.pendingMineTileKey) {
            this.resetPendingMineTarget(true)
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        return this.minerStep5()
    }

    minerStep5 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.miningPost || !this.pendingMineTileKey) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const targetTile = this.cave.getTile(this.pendingMineTileKey)
        if (!targetTile) {
            this.resetPendingMineTarget(true)
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const navTarget = this.miningPost.getNavigationTarget(this.cave, targetTile)
        if (!navTarget) {
            this.resetPendingMineTarget(true)
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const navFallback = () => {
            this.resetPendingMineTarget(true)
            return this.minerStep1()
        }
        if (!this.navigateTo(navTarget, navFallback)) {
            return false
        }

        if (this.location.x === navTarget.x && this.location.y === navTarget.y) {
            return this.minerStep6()
        }

        this.enqueueAction(() => this.minerStep6())
        return true
    }

    mineTile(tileKey) {
        const tile = this.cave.getTile(tileKey)
        if (!tile) {
            return false
        }

        const mineYield = this.getInventoryCapacity()
        if (this.getInventorySpace() < mineYield) {
            return false
        }

        const tileType = tile.getBase()
        if (!isMineableBase(tileType)) {
            return false
        }

        const tileCoords = toCoords(tileKey)

        if (tileType === 'wall') {
            const dist = Math.abs(this.location.x - tileCoords.x) + Math.abs(this.location.y - tileCoords.y)
            if (dist !== 1) {
                return false
            }

            const added = this.addToInventory('Sandstone', mineYield)
            // TODO: Add an ore for stone, and remove algae from the ore list 
            if (added !== mineYield) {
                return false
            }

            this.game.whenWallMined({ currentTarget: tile.sprite }, tile.sprite, this.cave, tileKey)
            if (this.cave.getTile(tileKey).getBase() === 'wall') {
                this.removeFromInventory(mineYield)
                return false
            }
            return true
        }

        if (this.location.x !== tileCoords.x || this.location.y !== tileCoords.y) {
            return false
        }

        const added = this.addToInventory(tileType, mineYield)
        if (added !== mineYield) {
            return false
        }

        tile.setBase('empty')
        tile.sprite.texture = PIXI.Texture.from('empty')
        if (typeof this.cave.notifyMineableTilesChanged === 'function') {
            this.cave.notifyMineableTilesChanged([tileKey])
        }
        return true
    }

    minerStep6 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.miningPost || !this.pendingMineTileKey) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const success = this.mineTile(this.pendingMineTileKey)
        this.resetPendingMineTarget(!success)

        if (!success) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        return this.minerStep1()
    }

}
