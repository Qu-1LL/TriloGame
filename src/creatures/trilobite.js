
import { Creature } from '../creature.js'
import * as PIXI from 'pixi.js'
import { AlgaeFarm } from '../buildings/algae-farm.js'
import { Barracks } from '../buildings/barracks.js'
import { MiningPost } from '../buildings/mining-post.js'
import { Queen } from '../buildings/queen.js'
import { Scaffolding } from '../buildings/scaffolding.js'
import { Ore } from '../ores.js'
import { toCoords, toKey } from '../cave.js'

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

function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function isEnemyCreature(creature) {
    return creature?.assignment === 'enemy' || creature?.constructor?.name === 'Enemy'
}

export class Trilobite extends Creature {

    constructor(name, location, game) {
        super(name, location, PIXI.Sprite.from('Trilobite'), game)
        this.inventory = {
            type: null,
            amount: 0
        }
        this.inventoryCapacity = 5
        this.assignedBuilding = null
        this.pendingMineTileKey = null
        this.fighterTargetTileKey = null
        this.fighterPathMode = null
        this.builderSourcePost = null
        this.builderWorkRate = 5
    }

    getInventory() {
        return this.inventory
    }

    hasInventory() {
        return this.inventory.amount > 0
    }

    getInventoryCapacity() {
        return this.inventoryCapacity
    }

    getInventorySpace() {
        return Math.max(0, this.inventoryCapacity - this.inventory.amount)
    }

    addToInventory(resourceType, amount) {
        if (typeof resourceType !== 'string' || !Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        if (!this.hasInventory()) {
            this.inventory.type = resourceType
        }

        if (this.inventory.type !== resourceType) {
            return 0
        }

        const added = Math.min(this.getInventorySpace(), amount)
        this.inventory.amount += added

        return added
    }

    removeFromInventory(amount) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        const removed = Math.min(this.inventory.amount, amount)
        this.inventory.amount -= removed

        if (this.inventory.amount === 0) {
            this.inventory.type = null
        }

        return removed
    }

    clearInventory() {
        this.inventory.type = null
        this.inventory.amount = 0
    }

    cleanupBeforeRemoval() {
        this.clearActionQueue()
        this.clearFighterTarget()
        this.fighterPathMode = null
        this.releaseAssignedBuilding()
        this.clearInventory()
    }

    getBehavior() {
        if (this.assignment === "miner") {
            return this.minerBehavior
        }
        if (this.assignment === "farmer") {
            return this.farmerBehavior
        }
        if (this.assignment === "builder") {
            return this.builderBehavior
        }
        if (this.assignment === "fighter") {
            return this.fighterBehavior
        }
        return this.unassignedBehavior
    }

    unassignedBehavior = () => {
        this.clearFighterTarget()
        this.fighterPathMode = null
        this.releaseAssignedBuilding()
        return false
    }

    minerBehavior = () => {
        return this.enqueueAction(() => this.minerStep1())
    }

    farmerBehavior = () => {
        return this.enqueueAction(() => this.farmerStep1())
    }

    builderBehavior = () => {
        return this.enqueueAction(() => this.builderStep1())
    }

    fighterBehavior = () => {
        return this.enqueueAction(() => this.fighterStep1())
    }

    isMiner() {
        return this.assignment === "miner"
    }

    isFarmer() {
        return this.assignment === "farmer"
    }

    isBuilder() {
        return this.assignment === "builder"
    }

    isFighter() {
        return this.assignment === "fighter"
    }

    fighterStep1 = () => {
        if (!this.ensureFighterState()) {
            return false
        }

        this.fighterPathMode = null

        if (!this.game.danger) {
            this.clearFighterTarget()
            return this.fighterReturnToBarracks(true)
        }

        if (this.fighterTargetTileKey && this.isAdjacentToTileKey(this.fighterTargetTileKey)) {
            return this.fighterStep2()
        }

        const adjacentEnemyTileKey = this.getAdjacentEnemyTileKey()
        if (adjacentEnemyTileKey) {
            this.fighterTargetTileKey = adjacentEnemyTileKey
            return this.fighterStep2()
        }

        return this.fighterStep3()
    }

    ensureMinerState() {
        this.clearFighterTarget()
        this.fighterPathMode = null

        if (this.isMiner()) {
            if (this.getAssignedBuilding() && !this.getAssignedMiningPost()) {
                this.releaseAssignedBuilding()
            }
            return true
        }

        if (this.getAssignedMiningPost()) {
            this.releaseAssignedBuilding()
        }
        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.minerBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    ensureFarmerState() {
        this.clearFighterTarget()
        this.fighterPathMode = null

        if (this.isFarmer()) {
            if (this.getAssignedBuilding() && !this.getAssignedAlgaeFarm()) {
                this.releaseAssignedBuilding()
            }
            return true
        }

        if (this.getAssignedAlgaeFarm()) {
            this.releaseAssignedBuilding()
        }
        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.farmerBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    ensureBuilderState() {
        this.clearFighterTarget()
        this.fighterPathMode = null

        if (this.isBuilder()) {
            if (this.getAssignedBuilding() && !this.getAssignedScaffolding()) {
                this.releaseAssignedBuilding()
            }
            return true
        }

        if (this.getAssignedScaffolding()) {
            this.releaseAssignedBuilding()
        } else {
            this.clearBuilderSourcePost()
        }

        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.builderBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    ensureFighterState() {
        if (this.isFighter()) {
            if (this.getAssignedBuilding() && !this.getAssignedBarracks()) {
                this.releaseAssignedBuilding()
            }
            return true
        }

        this.clearFighterTarget()
        this.fighterPathMode = null
        if (this.getAssignedBarracks()) {
            this.releaseAssignedBuilding()
        }

        const fallbackBehavior = this.getBehavior()
        if (typeof fallbackBehavior === 'function' && fallbackBehavior !== this.fighterBehavior) {
            fallbackBehavior.call(this)
        }
        return false
    }

    getAlgaeFarms() {
        if (!this.cave) {
            return []
        }

        const farms = []
        for (const building of this.cave.buildings) {
            if (building instanceof AlgaeFarm) {
                farms.push(building)
            }
        }
        return farms
    }

    getQueen() {
        if (!this.cave) {
            return null
        }

        for (const building of this.cave.buildings) {
            if (building instanceof Queen) {
                return building
            }
        }

        return null
    }

    getClosestPassableBuildingTile(building, startLocation = this.location) {
        if (!building || !Array.isArray(building.tileArray) || building.tileArray.length === 0) {
            return null
        }

        let bestTile = null
        let bestDist = Infinity

        for (const tile of building.tileArray) {
            if (!tile.creatureFits()) {
                continue
            }

            const tileCoords = toCoords(tile.key)
            const dist = squaredDistance(startLocation, tileCoords)
            if (dist < bestDist) {
                bestDist = dist
                bestTile = tileCoords
            }
        }

        return bestTile
    }

    isOnPassableBuildingTile(building, location = this.location) {
        if (!building || !Array.isArray(building.tileArray)) {
            return false
        }

        const locationKey = toKey(location)
        for (const tile of building.tileArray) {
            if (tile.key === locationKey && tile.creatureFits()) {
                return true
            }
        }

        return false
    }

    feedQueenAlgae(queen) {
        if (!queen || !this.hasInventory() || this.inventory.type !== 'Algae') {
            return 0
        }

        const amountToFeed = this.inventory.amount
        const result = queen.feedAlgae(amountToFeed, this, this.cave)
        if (!result || result.accepted <= 0) {
            return 0
        }

        this.removeFromInventory(result.accepted)
        return result.accepted
    }

    getAssignedBuilding() {
        return this.assignedBuilding
    }

    getAssignedAlgaeFarm() {
        if (this.assignedBuilding instanceof AlgaeFarm) {
            return this.assignedBuilding
        }
        return null
    }

    getAssignedMiningPost() {
        if (this.assignedBuilding instanceof MiningPost) {
            return this.assignedBuilding
        }
        return null
    }

    getAssignedBarracks() {
        if (this.assignedBuilding instanceof Barracks) {
            return this.assignedBuilding
        }
        return null
    }

    getAssignedScaffolding() {
        if (this.assignedBuilding instanceof Scaffolding) {
            return this.assignedBuilding
        }
        return null
    }

    setAssignedBuilding(building) {
        if (this.assignedBuilding === building) {
            return true
        }

        this.releaseAssignedBuilding()
        this.assignedBuilding = building ?? null
        return true
    }

    releaseAssignedBuilding() {
        this.clearBuilderSourcePost()

        const assignedBuilding = this.assignedBuilding
        if (!assignedBuilding) {
            this.pendingMineTileKey = null
            return
        }

        if (assignedBuilding instanceof MiningPost) {
            if (this.pendingMineTileKey) {
                assignedBuilding.invalidateMineableQueues()
            }
            assignedBuilding.removeAssignment(this)
        } else if (assignedBuilding instanceof AlgaeFarm || assignedBuilding instanceof Barracks) {
            assignedBuilding.removeAssignment(this)
        } else if (assignedBuilding instanceof Scaffolding) {
            assignedBuilding.removeAssignment(this)
            assignedBuilding.releaseMaterialReservation(this)
        }

        this.pendingMineTileKey = null
        this.assignedBuilding = null
    }

    clearBuilderSourcePost(releaseReservation = true) {
        if (releaseReservation && this.builderSourcePost && typeof this.builderSourcePost.releaseMaterialReservation === 'function') {
            this.builderSourcePost.releaseMaterialReservation(this)
        }

        this.builderSourcePost = null
    }

    getBuilderWorkRate() {
        return this.builderWorkRate
    }

    clearFighterTarget() {
        this.fighterTargetTileKey = null
    }

    getBarracksBuildings() {
        if (!this.cave) {
            return []
        }

        const barracksBuildings = []
        for (const building of this.cave.buildings) {
            if (building instanceof Barracks) {
                barracksBuildings.push(building)
            }
        }
        return barracksBuildings
    }

    getBarracksAtLocation(location = this.location) {
        for (const barracks of this.getBarracksBuildings()) {
            if (this.isOnPassableBuildingTile(barracks, location)) {
                return barracks
            }
        }
        return null
    }

    getBarracksPriorityList() {
        const viableBarracks = this.getBarracksBuildings().filter(
            (barracks) => this.getClosestPassableBuildingTile(barracks, this.location) !== null
        )
        if (viableBarracks.length === 0) {
            return []
        }

        return [...viableBarracks].sort((a, b) => {
            const loadDiff = a.getVolume() - b.getVolume()
            if (loadDiff !== 0) {
                return loadDiff
            }

            const aApproach = this.getClosestPassableBuildingTile(a, this.location)
            const bApproach = this.getClosestPassableBuildingTile(b, this.location)
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

    getEnemyCreatures() {
        if (!this.cave) {
            return []
        }

        const enemies = []
        for (const creature of this.cave.enemies) {
            if (!isEnemyCreature(creature)) {
                continue
            }

            enemies.push(creature)
        }
        return enemies
    }

    getEnemyAtTileKey(tileKey) {
        if (!tileKey) {
            return null
        }

        for (const enemy of this.getEnemyCreatures()) {
            if (toKey(enemy.location) === tileKey) {
                return enemy
            }
        }

        return null
    }

    isAdjacentToTileKey(tileKey, location = this.location) {
        const tileCoords = toCoords(tileKey)
        if (!Number.isFinite(tileCoords?.x) || !Number.isFinite(tileCoords?.y)) {
            return false
        }

        return manhattanDistance(location, tileCoords) === 1
    }

    getAdjacentEnemyTileKey(location = this.location) {
        if (!this.cave) {
            return null
        }

        const currentTile = this.cave.getTile(toKey(location))
        if (!currentTile) {
            return null
        }

        for (const neighbor of currentTile.getNeighbors()) {
            if (this.getEnemyAtTileKey(neighbor.key)) {
                return neighbor.key
            }
        }

        return null
    }

    queueFighterPath(path, mode = null, clearExisting = true) {
        if (!path || path.length === 0) {
            return false
        }

        if (clearExisting) {
            this.clearActionQueue()
        }

        if (path.length < 2) {
            this.fighterPathMode = null
            return true
        }

        this.fighterPathMode = mode

        const steps = [...path]
        steps.shift()

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            const next = { x: step.x, y: step.y }
            const isLastStep = i === (steps.length - 1)
            this.pathPreview.push(next)
            this.enqueueAction(() => this.fighterStepMove(next, isLastStep))
        }

        return true
    }

    tryNavigateBarracks = (orderedBarracks, index = 0) => {
        if (!this.ensureFighterState()) {
            return false
        }

        if (!orderedBarracks || index >= orderedBarracks.length) {
            return false
        }

        const barracks = orderedBarracks[index]
        if (!barracks) {
            return this.tryNavigateBarracks(orderedBarracks, index + 1)
        }

        this.setAssignedBuilding(barracks)
        barracks.assign(this)

        if (this.isOnPassableBuildingTile(barracks, this.location)) {
            return false
        }

        const approachTile = this.getClosestPassableBuildingTile(barracks, this.location)
        if (!approachTile) {
            this.releaseAssignedBuilding()
            return this.tryNavigateBarracks(orderedBarracks, index + 1)
        }

        const path = this.buildNavigationPathToBuilding(barracks)
        if (!path) {
            this.releaseAssignedBuilding()
            return this.tryNavigateBarracks(orderedBarracks, index + 1)
        }

        return this.queueFighterPath(path, 'barracks')
    }

    fighterReturnToBarracks = (preferAssignedBarracks = true) => {
        if (!this.ensureFighterState()) {
            return false
        }

        const assignedBarracks = this.getAssignedBarracks()
        if (preferAssignedBarracks && assignedBarracks) {
            assignedBarracks.assign(this)
            if (this.isOnPassableBuildingTile(assignedBarracks, this.location)) {
                return false
            }

            const orderedBarracks = [
                assignedBarracks,
                ...this.getBarracksPriorityList().filter((barracks) => barracks !== assignedBarracks)
            ]
            return this.tryNavigateBarracks(orderedBarracks, 0)
        }

        if (preferAssignedBarracks) {
            const currentBarracks = this.getBarracksAtLocation()
            if (currentBarracks) {
                this.setAssignedBuilding(currentBarracks)
                currentBarracks.assign(this)
                return false
            }
        }

        const orderedBarracks = this.getBarracksPriorityList()
        if (orderedBarracks.length === 0) {
            if (!preferAssignedBarracks) {
                this.releaseAssignedBuilding()
            }
            return false
        }

        return this.tryNavigateBarracks(orderedBarracks, 0)
    }

    fighterStep2 = () => {
        if (!this.ensureFighterState()) {
            return false
        }

        if (!this.game.danger) {
            this.clearFighterTarget()
            return this.fighterReturnToBarracks(true)
        }

        if (!this.fighterTargetTileKey) {
            return this.fighterStep3()
        }

        const enemy = this.getEnemyAtTileKey(this.fighterTargetTileKey)
        if (!enemy) {
            this.clearFighterTarget()
            return this.fighterStep3()
        }

        if (!this.isAdjacentToTileKey(this.fighterTargetTileKey)) {
            return this.fighterStep3()
        }

        const dealt = this.dealDamage(enemy)
        if (!this.getEnemyAtTileKey(this.fighterTargetTileKey)) {
            this.clearFighterTarget()
        }

        return dealt > 0
    }

    fighterStep3 = () => {
        if (!this.ensureFighterState()) {
            return false
        }

        if (!this.game.danger) {
            this.clearFighterTarget()
            return this.fighterReturnToBarracks(true)
        }

        if (this.fighterTargetTileKey && !this.getEnemyAtTileKey(this.fighterTargetTileKey)) {
            this.clearFighterTarget()
        }

        const nextLocation = this.cave?.getBfsFieldNextStep('enemy', this.location)
        if (!nextLocation) {
            this.clearFighterTarget()
            return this.fighterReturnToBarracks(false)
        }

        this.clearActionQueue()
        this.pathPreview.push({ x: nextLocation.x, y: nextLocation.y })
        return this.fighterStepMove(nextLocation)
    }

    fighterStepMove = (nextLocation) => {
        if (!this.ensureFighterState()) {
            return false
        }

        if (!this.game.danger) {
            if (this.fighterPathMode !== 'barracks') {
                this.clearActionQueue()
                return this.fighterStep1()
            }

            const assignedBarracks = this.getAssignedBarracks()
            if (assignedBarracks && this.isOnPassableBuildingTile(assignedBarracks, this.location)) {
                this.fighterPathMode = null
                this.clearActionQueue()
                return false
            }
        } else if (this.fighterPathMode === 'barracks') {
            this.fighterPathMode = null
            this.clearActionQueue()
            return this.fighterStep1()
        }

        if (this.fighterPathMode !== 'barracks') {
            if (this.fighterTargetTileKey && !this.getEnemyAtTileKey(this.fighterTargetTileKey)) {
                this.clearFighterTarget()
                this.clearActionQueue()
                return this.fighterStep3()
            }

            const adjacentEnemyTileKey = this.getAdjacentEnemyTileKey()
            if (adjacentEnemyTileKey) {
                this.fighterTargetTileKey = adjacentEnemyTileKey
                this.clearActionQueue()
                return this.fighterStep2()
            }
        }

        const wasBarracksMove = this.fighterPathMode === 'barracks'
        const moved = this.performMove(nextLocation)
        if (moved === false) {
            if (wasBarracksMove) {
                this.fighterPathMode = null
            }
            this.clearActionQueue()
            return wasBarracksMove ? this.fighterReturnToBarracks(true) : this.fighterStep3()
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }

        if (wasBarracksMove) {
            const assignedBarracks = this.getAssignedBarracks()
            if (assignedBarracks && this.isOnPassableBuildingTile(assignedBarracks, this.location)) {
                this.fighterPathMode = null
                this.clearActionQueue()
                return false
            }

            return moved
        }

        if (this.fighterTargetTileKey && this.isAdjacentToTileKey(this.fighterTargetTileKey)) {
            this.clearActionQueue()
            return this.fighterStep2()
        }

        const nextAdjacentEnemyTileKey = this.getAdjacentEnemyTileKey()
        if (nextAdjacentEnemyTileKey) {
            this.fighterTargetTileKey = nextAdjacentEnemyTileKey
            this.clearActionQueue()
            return this.fighterStep2()
        }

        return moved
    }

    getAlgaeFarmPriorityList() {
        const viableFarms = this.getAlgaeFarms().filter((farm) => farm.getApproachTile(this.location) !== null)
        if (viableFarms.length === 0) {
            return []
        }

        return [...viableFarms].sort((a, b) => {
            const loadDiff = a.getVolume() - b.getVolume()
            if (loadDiff !== 0) {
                return loadDiff
            }

            const aApproach = a.getApproachTile(this.location)
            const bApproach = b.getApproachTile(this.location)
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

    tryNavigateAlgaeFarms = (orderedFarms, index = 0) => {
        if (!this.ensureFarmerState()) {
            return false
        }

        if (!orderedFarms || index >= orderedFarms.length) {
            this.releaseAssignedBuilding()
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        const farm = orderedFarms[index]
        this.setAssignedBuilding(farm)
        farm.assign(this)

        if (farm.isLocationOnFarm(this.location)) {
            return this.farmerStep2()
        }

        const approachTile = farm.getApproachTile(this.location)
        if (!approachTile) {
            this.releaseAssignedBuilding()
            return this.tryNavigateAlgaeFarms(orderedFarms, index + 1)
        }

        const navFallback = () => {
            this.releaseAssignedBuilding()
            return this.tryNavigateAlgaeFarms(orderedFarms, index + 1)
        }

        if (!this.navigateToBuilding(farm, navFallback)) {
            this.releaseAssignedBuilding()
            return this.tryNavigateAlgaeFarms(orderedFarms, index + 1)
        }

        this.enqueueAction(() => this.farmerStep2())
        return true
    }

    farmerStep1 = () => {
        if (!this.ensureFarmerState()) {
            return false
        }

        if (this.hasInventory()) {
            if (this.inventory.type === 'Algae') {
                return this.farmerStep4()
            }
            this.clearInventory()
        }

        const orderedFarms = this.getAlgaeFarmPriorityList()
        if (orderedFarms.length === 0) {
            this.releaseAssignedBuilding()
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        return this.tryNavigateAlgaeFarms(orderedFarms, 0)
    }

    farmerStep2 = () => {
        if (!this.ensureFarmerState()) {
            return false
        }

        const farm = this.getAssignedAlgaeFarm()
        if (!farm) {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        if (!farm.isLocationOnFarm(this.location)) {
            const approachTile = farm.getApproachTile(this.location)
            if (!approachTile) {
                this.releaseAssignedBuilding()
                this.enqueueAction(() => this.farmerStep1())
                return false
            }

            const navFallback = () => {
                this.releaseAssignedBuilding()
                return this.farmerStep1()
            }
            if (!this.navigateToBuilding(farm, navFallback)) {
                return false
            }

            this.enqueueAction(() => this.farmerStep2())
            return true
        }

        const farmPath = farm.getPath(this.location)
        if (!farmPath || farmPath.length < 2) {
            if (farm.tryHarvest(this)) {
                return this.farmerStep4()
            }

            this.enqueueAction(() => this.farmerStep2())
            return false
        }

        for (let i = 1; i < farmPath.length; i++) {
            const next = { x: farmPath[i].x, y: farmPath[i].y }
            const isLastStep = (i === farmPath.length - 1)
            this.enqueueAction(() => this.farmerStep3(next, isLastStep))
        }
        return true
    }

    farmerStep3 = (nextLocation, isLastStep = false) => {
        if (!this.ensureFarmerState()) {
            return false
        }

        const farm = this.getAssignedAlgaeFarm()
        if (!farm) {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        const moved = this.performMove(nextLocation)
        if (moved === false) {
            this.clearActionQueue()
            this.enqueueAction(() => this.farmerStep2())
            return false
        }

        if (!farm.tryHarvest(this)) {
            if (isLastStep) {
                return this.farmerStep2()
            }
            return moved
        }

        this.clearActionQueue()
        return this.farmerStep4()
    }

    farmerStep4 = () => {
        if (!this.ensureFarmerState()) {
            return false
        }

        if (!this.hasInventory() || this.inventory.type !== 'Algae') {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        const queen = this.getQueen()
        if (!queen) {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        if (this.isOnPassableBuildingTile(queen, this.location)) {
            return this.farmerStep5()
        }

        const nextLocation = this.cave?.getBuildingBfsFieldNextStep(queen, this.location)
        if (!nextLocation) {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        this.clearActionQueue()
        this.pathPreview.push({ x: nextLocation.x, y: nextLocation.y })
        return this.farmerStepMoveToQueen(nextLocation)
    }

    farmerStepMoveToQueen = (nextLocation) => {
        if (!this.ensureFarmerState()) {
            return false
        }

        const moved = this.performMove(nextLocation)
        if (moved === false) {
            this.clearActionQueue()
            return this.farmerStep4()
        }

        if (this.pathPreview.length > 0) {
            this.pathPreview.shift()
        }

        return moved
    }

    farmerStep5 = () => {
        if (!this.ensureFarmerState()) {
            return false
        }

        const queen = this.getQueen()
        if (!queen) {
            this.enqueueAction(() => this.farmerStep1())
            return false
        }

        if (!this.isOnPassableBuildingTile(queen, this.location)) {
            return this.farmerStep4()
        }

        const fed = this.feedQueenAlgae(queen)
        if (fed <= 0) {
            this.enqueueAction(() => this.farmerStep4())
            return false
        }
        return this.farmerStep1()
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

    resetPendingMineTarget(requeue = false) {
        const miningPost = this.getAssignedMiningPost()
        if (requeue && miningPost && this.pendingMineTileKey) {
            miningPost.invalidateMineableQueues()
        }
        if (miningPost) {
            miningPost.assign(this, null)
        }
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
            this.releaseAssignedBuilding()
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const post = orderedPosts[index]
        this.setAssignedBuilding(post)
        post.assign(this, null)

        if (post.isLocationInArea(this.location)) {
            return this.minerStep2()
        }

        const approachTile = post.getApproachTile(this.cave, this.location)
        if (!approachTile) {
            this.releaseAssignedBuilding()
            return this.tryNavigateMiningPosts(orderedPosts, index + 1)
        }

        const navFallback = () => {
            this.releaseAssignedBuilding()
            return this.tryNavigateMiningPosts(orderedPosts, index + 1)
        }

        if (!this.navigateToBuilding(post, navFallback)) {
            this.releaseAssignedBuilding()
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

        const miningPost = this.getAssignedMiningPost()
        if (!miningPost) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        if (this.hasInventory()) {
            if (!miningPost.isLocationOnPost(this.location)) {
                const approachTile = miningPost.getApproachTile(this.cave, this.location)
                if (!approachTile) {
                    this.releaseAssignedBuilding()
                    this.enqueueAction(() => this.minerStep1())
                    return false
                }

                const navFallback = () => {
                    this.releaseAssignedBuilding()
                    return this.minerStep1()
                }
                if (!this.navigateToBuilding(miningPost, navFallback)) {
                    return false
                }

                this.enqueueAction(() => this.minerStep2())
                return true
            }

            const accepted = miningPost.deposit(this.inventory.type, this.inventory.amount)
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

        const miningPost = this.getAssignedMiningPost()
        if (!miningPost) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const targetTile = miningPost.grabMineableTile(this.cave, this)
        if (!targetTile) {
            miningPost.assign(this, null)
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

        const miningPost = this.getAssignedMiningPost()
        if (!miningPost || !this.pendingMineTileKey) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        if (miningPost.getAssignment(this) !== this.pendingMineTileKey) {
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

        const miningPost = this.getAssignedMiningPost()
        if (!miningPost || !this.pendingMineTileKey) {
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const targetTile = this.cave.getTile(this.pendingMineTileKey)
        if (!targetTile) {
            this.resetPendingMineTarget(true)
            this.enqueueAction(() => this.minerStep1())
            return false
        }

        const navTarget = miningPost.getNavigationTarget(this.cave, targetTile)
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

            if (!this.game.mineTile(this.cave, tileKey, 'creature')) {
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

        if (!this.game.mineTile(this.cave, tileKey, 'creature')) {
            this.removeFromInventory(mineYield)
            return false
        }

        return true
    }

    minerStep6 = () => {
        if (!this.ensureMinerState()) {
            return false
        }

        if (!this.getAssignedMiningPost() || !this.pendingMineTileKey) {
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

    getScaffoldingBuildings() {
        if (!this.cave) {
            return []
        }

        const scaffoldingBuildings = []
        for (const building of this.cave.buildings) {
            if (building instanceof Scaffolding && building.isInProgress()) {
                scaffoldingBuildings.push(building)
            }
        }

        return scaffoldingBuildings
    }

    getBuilderSupplyOptionForScaffold(scaffold, orderedPosts = this.getBuilderMiningPostPriorityList()) {
        if (!(scaffold instanceof Scaffolding)) {
            return null
        }

        const neededResources = scaffold.getNeededResourceTypes({ includeReservations: true, excludeCreature: this })
        if (neededResources.length === 0) {
            return null
        }

        for (const post of orderedPosts) {
            for (const resourceType of neededResources) {
                const missingAmount = scaffold.getUnreservedRemainingRequirement(resourceType, this)
                const availableAmount = post.getAvailableInventory(resourceType, this)
                const reserveAmount = Math.min(this.getInventoryCapacity(), missingAmount, availableAmount)
                if (reserveAmount <= 0) {
                    continue
                }

                return {
                    post,
                    resourceType,
                    amount: reserveAmount
                }
            }
        }

        return null
    }

    canActOnScaffold(scaffold) {
        if (!(scaffold instanceof Scaffolding) || !scaffold.isInProgress()) {
            return false
        }

        if (this.hasInventory()) {
            return scaffold.needsResource(this.inventory.type)
        }

        const scaffoldReservation = scaffold.getMaterialReservation(this)
        const postReservation = this.builderSourcePost?.getMaterialReservation(this)
        if (scaffoldReservation || postReservation) {
            return true
        }

        if (!scaffold.isRecipeComplete()) {
            return this.getBuilderSupplyOptionForScaffold(scaffold) !== null
        }

        if (scaffold.needsConstructionWork()) {
            return true
        }

        return scaffold.isConstructionComplete()
    }

    getScaffoldingPriorityList({ actionableOnly = false, excludeScaffolds = [] } = {}) {
        const excludedScaffolds = new Set(excludeScaffolds)
        const viableScaffolds = this.getScaffoldingBuildings().filter((scaffold) => {
            if (excludedScaffolds.has(scaffold)) {
                return false
            }

            const distance = this.cave?.getBuildingBfsFieldValue(scaffold, this.location) ?? Infinity
            if (!Number.isFinite(distance)) {
                return false
            }

            if (actionableOnly && !this.canActOnScaffold(scaffold)) {
                return false
            }

            return true
        })

        return [...viableScaffolds].sort((a, b) => {
            const loadDiff = a.getVolume() - b.getVolume()
            if (loadDiff !== 0) {
                return loadDiff
            }

            const aDistance = this.cave?.getBuildingBfsFieldValue(a, this.location) ?? Infinity
            const bDistance = this.cave?.getBuildingBfsFieldValue(b, this.location) ?? Infinity
            if (aDistance !== bDistance) {
                return aDistance - bDistance
            }

            return squaredDistance(this.location, a.location) - squaredDistance(this.location, b.location)
        })
    }

    getBuilderMiningPostPriorityList() {
        const viablePosts = this.getMiningPosts().filter((post) => {
            const distance = this.cave?.getBuildingBfsFieldValue(post, this.location) ?? Infinity
            return Number.isFinite(distance)
        })

        return [...viablePosts].sort((a, b) => {
            const aDistance = this.cave?.getBuildingBfsFieldValue(a, this.location) ?? Infinity
            const bDistance = this.cave?.getBuildingBfsFieldValue(b, this.location) ?? Infinity
            if (aDistance !== bDistance) {
                return aDistance - bDistance
            }

            return squaredDistance(this.location, a.location) - squaredDistance(this.location, b.location)
        })
    }

    isInBuildingWorkRange(building, location = this.location) {
        if (!this.cave || !building) {
            return false
        }

        return this.cave.getBuildingBfsFieldValue(building, location) === 0
    }

    ensureBuilderAssignment({ actionableOnly = false, excludeScaffolds = [] } = {}) {
        const excludedScaffolds = new Set(excludeScaffolds)
        const assignedScaffold = this.getAssignedScaffolding()
        if (
            assignedScaffold?.isInProgress() &&
            !excludedScaffolds.has(assignedScaffold) &&
            (!actionableOnly || this.canActOnScaffold(assignedScaffold))
        ) {
            assignedScaffold.assign(this)
            return assignedScaffold
        }

        if (assignedScaffold) {
            this.releaseAssignedBuilding()
        }

        const orderedScaffolds = this.getScaffoldingPriorityList({
            actionableOnly,
            excludeScaffolds
        })
        if (orderedScaffolds.length === 0) {
            this.releaseAssignedBuilding()
            return null
        }

        const scaffold = orderedScaffolds[0]
        this.setAssignedBuilding(scaffold)
        scaffold.assign(this)
        return scaffold
    }

    builderDepositInventoryToNearestMiningPost = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        if (!this.hasInventory()) {
            return this.builderStep1()
        }

        const orderedPosts = this.getBuilderMiningPostPriorityList().filter((post) => post.getInventorySpace() > 0)
        if (orderedPosts.length === 0) {
            return false
        }

        const post = orderedPosts[0]
        if (!post.isLocationOnPost(this.location)) {
            const navFallback = () => this.builderDepositInventoryToNearestMiningPost()
            if (!this.navigateToBuilding(post, navFallback)) {
                return false
            }

            this.enqueueAction(() => this.builderDepositInventoryToNearestMiningPost())
            return true
        }

        const accepted = post.deposit(this.inventory.type, this.inventory.amount)
        this.removeFromInventory(accepted)

        if (this.hasInventory()) {
            this.enqueueAction(() => this.builderDepositInventoryToNearestMiningPost())
            return false
        }

        return this.builderStep1()
    }

    builderStep1 = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        const scaffold = this.ensureBuilderAssignment({ actionableOnly: true })
        if (!scaffold) {
            if (this.hasInventory()) {
                return this.builderDepositInventoryToNearestMiningPost()
            }
            return false
        }

        const scaffoldReservation = scaffold.getMaterialReservation(this)
        const postReservation = this.builderSourcePost?.getMaterialReservation(this)

        if (this.hasInventory()) {
            if (scaffold.needsResource(this.inventory.type)) {
                return this.builderStep4()
            }
            scaffold.releaseMaterialReservation(this)
            return this.builderDepositInventoryToNearestMiningPost()
        }

        if (scaffoldReservation && this.builderSourcePost && postReservation) {
            return this.builderStep3()
        }

        if (scaffoldReservation && !this.builderSourcePost) {
            scaffold.releaseMaterialReservation(this)
        } else if (!scaffoldReservation && this.builderSourcePost) {
            this.clearBuilderSourcePost()
        }

        if (scaffold.needsAnyResource({ includeReservations: true, excludeCreature: this }) && this.builderStep2()) {
            return true
        }

        if (scaffold.isRecipeComplete() && scaffold.needsConstructionWork()) {
            return this.builderStep5()
        }

        if (scaffold.isRecipeComplete() && scaffold.isConstructionComplete()) {
            if (scaffold.tryCompleteConstruction(this)) {
                return true
            }
        }

        this.releaseAssignedBuilding()
        return false
    }

    builderStep2 = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        const scaffold = this.getAssignedScaffolding()
        if (!scaffold) {
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        const orderedPosts = this.getBuilderMiningPostPriorityList()
        const supplyOption = this.getBuilderSupplyOptionForScaffold(scaffold, orderedPosts)
        if (!supplyOption) {
            return false
        }

        const scaffoldReserved = scaffold.reserveMaterial(this, supplyOption.resourceType, supplyOption.amount)
        if (scaffoldReserved <= 0) {
            return false
        }

        const postReserved = supplyOption.post.reserveMaterial(this, supplyOption.resourceType, scaffoldReserved)
        if (postReserved !== scaffoldReserved) {
            scaffold.releaseMaterialReservation(this)
            supplyOption.post.releaseMaterialReservation(this)
            return false
        }

        this.builderSourcePost = supplyOption.post

        if (supplyOption.post.isLocationOnPost(this.location)) {
            return this.builderStep3()
        }

        const navFallback = () => {
            scaffold.releaseMaterialReservation(this)
            this.clearBuilderSourcePost()
            return this.builderStep1()
        }

        if (!this.navigateToBuilding(supplyOption.post, navFallback)) {
            return false
        }

        this.enqueueAction(() => this.builderStep3())
        return true
    }

    builderStep3 = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        const scaffold = this.getAssignedScaffolding()
        const post = this.builderSourcePost
        const scaffoldReservation = scaffold?.getMaterialReservation(this)
        const postReservation = post?.getMaterialReservation(this)

        if (!scaffold || !post || !scaffoldReservation || !postReservation || scaffoldReservation.resourceType !== postReservation.resourceType) {
            scaffold?.releaseMaterialReservation(this)
            this.clearBuilderSourcePost()
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        if (this.hasInventory()) {
            return this.builderStep4()
        }

        if (!post.isLocationOnPost(this.location)) {
            const navFallback = () => {
                scaffold.releaseMaterialReservation(this)
                this.clearBuilderSourcePost()
                return this.builderStep1()
            }

            if (!this.navigateToBuilding(post, navFallback)) {
                return false
            }

            this.enqueueAction(() => this.builderStep3())
            return true
        }

        const withdrawn = post.withdrawReservedMaterial(this, Math.min(this.getInventorySpace(), scaffoldReservation.amount))
        if (!withdrawn || withdrawn.amount <= 0) {
            scaffold.releaseMaterialReservation(this)
            this.clearBuilderSourcePost()
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        const added = this.addToInventory(withdrawn.resourceType, withdrawn.amount)
        if (added !== withdrawn.amount) {
            post.deposit(withdrawn.resourceType, withdrawn.amount)
            scaffold.releaseMaterialReservation(this)
            this.clearBuilderSourcePost()
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        this.builderSourcePost = null
        return this.builderStep4()
    }

    builderStep4 = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        const scaffold = this.getAssignedScaffolding()
        if (!this.hasInventory()) {
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        if (!scaffold || !scaffold.isInProgress()) {
            return this.builderDepositInventoryToNearestMiningPost()
        }

        if (!scaffold.needsResource(this.inventory.type)) {
            scaffold.releaseMaterialReservation(this)
            return this.builderDepositInventoryToNearestMiningPost()
        }

        if (!this.isInBuildingWorkRange(scaffold)) {
            const navFallback = () => {
                scaffold.releaseMaterialReservation(this)
                return this.builderDepositInventoryToNearestMiningPost()
            }

            if (!this.navigateToBuilding(scaffold, navFallback)) {
                return false
            }

            this.enqueueAction(() => this.builderStep4())
            return true
        }

        const accepted = scaffold.deposit(this.inventory.type, this.inventory.amount, this)
        this.removeFromInventory(accepted)

        if (this.hasInventory()) {
            return this.builderDepositInventoryToNearestMiningPost()
        }

        return this.builderStep1()
    }

    builderStep5 = () => {
        if (!this.ensureBuilderState()) {
            return false
        }

        const scaffold = this.getAssignedScaffolding()
        if (!scaffold || !scaffold.isInProgress()) {
            this.releaseAssignedBuilding()
            return false
        }

        if (this.hasInventory()) {
            return this.builderStep4()
        }

        if (!scaffold.isRecipeComplete()) {
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        if (!scaffold.needsConstructionWork()) {
            return this.builderStep1()
        }

        if (!this.isInBuildingWorkRange(scaffold)) {
            const navFallback = () => this.builderStep1()
            if (!this.navigateToBuilding(scaffold, navFallback)) {
                return false
            }

            this.enqueueAction(() => this.builderStep5())
            return true
        }

        const worked = scaffold.applyConstructionWork(this.getBuilderWorkRate(), this)
        if (worked <= 0) {
            this.enqueueAction(() => this.builderStep1())
            return false
        }

        return worked
    }

}
