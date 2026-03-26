import * as PIXI from 'pixi.js'
import {
    Building,
    BUILD_TILE_HALF_SIZE,
    BUILD_TILE_SIZE,
    cloneOpenMap,
    cloneSize,
    normalizeRecipe
} from '../building.js'
import { Ore } from '../ores.js'

function buildScaffoldOpenMap(targetOpenMap) {
    return cloneOpenMap(targetOpenMap).map((row) => row.map((cell) => {
        if (cell > 1) {
            return cell
        }
        return 0
    }))
}

function buildEmptyDeposits(recipeRequired) {
    const recipeDeposited = {}
    for (const resourceType of Object.keys(recipeRequired)) {
        recipeDeposited[resourceType] = 0
    }
    return recipeDeposited
}

function getResourceConstructionWeight(resourceType) {
    const oreIndex = Ore.getOres().findIndex((ore) => ore.name === resourceType)
    if (oreIndex >= 0) {
        return oreIndex + 1
    }
    return 1
}

function buildConstructionRequirement(recipeRequired) {
    let requiredWork = 0

    for (const [resourceType, amount] of Object.entries(recipeRequired)) {
        requiredWork += amount * getResourceConstructionWeight(resourceType)
    }

    return Math.max(1, requiredWork)
}

export class Scaffolding extends Building {

    constructor(game, targetBuilding, recipeOverride = null) {
        if (!(targetBuilding instanceof Building)) {
            throw new Error('Scaffolding requires a valid target building instance.')
        }

        const recipeRequired = normalizeRecipe(
            recipeOverride ?? (
                typeof targetBuilding.getRecipe === 'function'
                    ? targetBuilding.getRecipe()
                    : targetBuilding.recipe
            )
        )

        if (!recipeRequired) {
            throw new Error(`Scaffolding requires a valid recipe for ${targetBuilding.getName()}.`)
        }

        super(
            `${targetBuilding.getName()} Scaffolding`,
            cloneSize(targetBuilding.size),
            buildScaffoldOpenMap(targetBuilding.openMap),
            game,
            false
        )

        this.targetBuilding = targetBuilding
        this.recipeRequired = recipeRequired
        this.recipeDeposited = buildEmptyDeposits(this.recipeRequired)
        this.recipeComplete = false
        this.materialReservations = new Map()
        this.assignments = new Set()
        this.constructionProgress = 0
        this.constructionRequired = buildConstructionRequirement(this.recipeRequired)
        this.constructionComplete = false
        this.completionPending = false
        this.selectable = true
        this.description = `A construction site for ${targetBuilding.getName()}.`
        this.sprite = this.createDisplayObject()
        this.syncTargetDisplayRotation()
    }

    static buildOpenMapFromTarget(targetBuilding) {
        return buildScaffoldOpenMap(targetBuilding?.openMap ?? [])
    }

    createDisplayObject() {
        const displayRoot = new PIXI.Container()
        displayRoot.sortableChildren = true
        this.rebuildDisplayObject(displayRoot)
        return displayRoot
    }

    rebuildDisplayObject(displayRoot = this.sprite) {
        if (!displayRoot) {
            return null
        }

        for (const child of [...displayRoot.children]) {
            displayRoot.removeChild(child)
            child.destroy()
        }

        displayRoot.hitArea = new PIXI.Rectangle(
            0,
            0,
            this.size.x * BUILD_TILE_SIZE,
            this.size.y * BUILD_TILE_SIZE
        )

        for (let y = 0; y < this.size.y; y++) {
            for (let x = 0; x < this.size.x; x++) {
                if (this.openMap[y][x] > 1) {
                    continue
                }

                const scaffoldCell = PIXI.Sprite.from('Scaffold')
                scaffoldCell.x = x * BUILD_TILE_SIZE
                scaffoldCell.y = y * BUILD_TILE_SIZE
                scaffoldCell.width = BUILD_TILE_SIZE
                scaffoldCell.height = BUILD_TILE_SIZE
                scaffoldCell.zIndex = 0
                displayRoot.addChild(scaffoldCell)
            }
        }

        return displayRoot
    }

    syncTargetDisplayRotation() {
        if (this.targetBuilding?.sprite) {
            this.targetBuilding.sprite.rotation = this.sprite?.rotation ?? 0
        }
    }

    rotateMap() {
        this.targetBuilding.rotateMap()
        this.size = cloneSize(this.targetBuilding.size)
        this.openMap = Scaffolding.buildOpenMapFromTarget(this.targetBuilding)
        this.rebuildDisplayObject()
        this.syncTargetDisplayRotation()
        return this.openMap
    }

    updateRecipeCompleteState() {
        this.recipeComplete = Object.entries(this.recipeRequired).every(([resourceType, amountRequired]) => {
            return (this.recipeDeposited[resourceType] ?? 0) >= amountRequired
        })

        return this.recipeComplete
    }

    updateConstructionCompleteState() {
        this.constructionComplete = this.constructionProgress >= this.constructionRequired
        return this.constructionComplete
    }

    getAssignments() {
        return this.assignments
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

    getMaterialReservation(creature) {
        const reservation = this.materialReservations.get(creature)
        return reservation ? { ...reservation } : null
    }

    getReservedAmount(resourceType, excludeCreature = null) {
        if (typeof resourceType !== 'string') {
            return 0
        }

        let reservedAmount = 0
        for (const [creature, reservation] of this.materialReservations.entries()) {
            if (creature === excludeCreature || reservation?.resourceType !== resourceType) {
                continue
            }

            reservedAmount += reservation.amount ?? 0
        }

        return reservedAmount
    }

    getUnreservedRemainingRequirement(resourceType, excludeCreature = null) {
        return Math.max(
            0,
            this.getRemainingRequirement(resourceType) - this.getReservedAmount(resourceType, excludeCreature)
        )
    }

    getNeededResourceTypes({ includeReservations = false, excludeCreature = null } = {}) {
        const neededResources = []

        for (const resourceType of Object.keys(this.recipeRequired)) {
            const remaining = includeReservations
                ? this.getUnreservedRemainingRequirement(resourceType, excludeCreature)
                : this.getRemainingRequirement(resourceType)

            if (remaining > 0) {
                neededResources.push(resourceType)
            }
        }

        return neededResources
    }

    needsAnyResource(options = {}) {
        return this.getNeededResourceTypes(options).length > 0
    }

    reserveMaterial(creature, resourceType, amount) {
        if (!creature || typeof resourceType !== 'string' || !Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        this.releaseMaterialReservation(creature)

        const reserved = Math.min(amount, this.getUnreservedRemainingRequirement(resourceType, creature))
        if (reserved <= 0) {
            return 0
        }

        this.materialReservations.set(creature, {
            resourceType,
            amount: reserved
        })

        return reserved
    }

    releaseMaterialReservation(creature) {
        const reservation = this.materialReservations.get(creature) ?? null
        this.materialReservations.delete(creature)
        return reservation
    }

    needsResource(resourceType, { includeReservations = false, excludeCreature = null } = {}) {
        const remaining = includeReservations
            ? this.getUnreservedRemainingRequirement(resourceType, excludeCreature)
            : this.getRemainingRequirement(resourceType)

        return remaining > 0
    }

    getRemainingRequirement(resourceType) {
        if (typeof resourceType !== 'string' || !(resourceType in this.recipeRequired)) {
            return 0
        }

        return Math.max(0, this.recipeRequired[resourceType] - (this.recipeDeposited[resourceType] ?? 0))
    }

    canAcceptDeposit(resourceType, amount = 1) {
        return Number.isFinite(amount) && amount > 0 && this.needsResource(resourceType)
    }

    deposit(resourceType, amount, creature = null) {
        if (creature) {
            this.releaseMaterialReservation(creature)
        }

        if (!this.canAcceptDeposit(resourceType, amount)) {
            this.tryCompleteConstruction()
            return 0
        }

        const accepted = Math.min(amount, this.getRemainingRequirement(resourceType))
        if (accepted <= 0) {
            this.tryCompleteConstruction()
            return 0
        }

        this.recipeDeposited[resourceType] += accepted

        this.updateRecipeCompleteState()
        this.tryCompleteConstruction(creature)

        return accepted
    }

    isRecipeComplete() {
        return this.updateRecipeCompleteState()
    }

    getConstructionProgress() {
        return this.constructionProgress
    }

    getConstructionRequired() {
        return this.constructionRequired
    }

    getConstructionRemaining() {
        return Math.max(0, this.constructionRequired - this.constructionProgress)
    }

    needsConstructionWork() {
        return this.getConstructionRemaining() > 0
    }

    isConstructionComplete() {
        return this.updateConstructionCompleteState()
    }

    applyConstructionWork(amount, creature = null) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return 0
        }

        const applied = Math.min(amount, this.getConstructionRemaining())
        if (applied <= 0) {
            this.tryCompleteConstruction(creature)
            return 0
        }

        this.constructionProgress += applied
        this.updateConstructionCompleteState()
        this.tryCompleteConstruction(creature)
        return applied
    }

    isInProgress() {
        return this.completionPending || !this.isRecipeComplete() || !this.isConstructionComplete()
    }

    getRecipeProgress() {
        const remaining = {}
        for (const resourceType of Object.keys(this.recipeRequired)) {
            remaining[resourceType] = this.getRemainingRequirement(resourceType)
        }

        return {
            required: { ...this.recipeRequired },
            deposited: { ...this.recipeDeposited },
            remaining,
            complete: this.isRecipeComplete(),
            reserved: Object.fromEntries(
                Object.keys(this.recipeRequired).map((resourceType) => [resourceType, this.getReservedAmount(resourceType)])
            ),
            construction: {
                progress: this.getConstructionProgress(),
                required: this.getConstructionRequired(),
                remaining: this.getConstructionRemaining(),
                complete: this.isConstructionComplete()
            },
            completionPending: this.completionPending
        }
    }

    tryCompleteConstruction(source = null) {
        if (!this.isRecipeComplete() || !this.isConstructionComplete()) {
            this.completionPending = false
            return false
        }

        this.completionPending = true
        return this.completeConstruction(source)
    }

    cleanupBeforeRemoval() {
        this.assignments.clear()
        this.materialReservations.clear()
        this.completionPending = false
    }

    completeConstruction(source = null) {
        if (!this.isRecipeComplete() || !this.isConstructionComplete()) {
            this.completionPending = false
            return false
        }

        const activeCave = this.cave
        const targetBuilding = this.targetBuilding
        const location = {
            x: this.location.x,
            y: this.location.y
        }
        const displayRotation = this.sprite?.rotation ?? 0

        if (!activeCave || !targetBuilding || !Number.isFinite(location.x) || !Number.isFinite(location.y)) {
            return false
        }

        let scaffoldRemoved = false

        try {
            if (targetBuilding?.sprite) {
                targetBuilding.sprite.rotation = displayRotation
            }

            if (!activeCave.removeBuilding(this, source ?? 'scaffoldingComplete')) {
                return false
            }
            scaffoldRemoved = true

            if (activeCave.build(targetBuilding, location, targetBuilding.sprite)) {
                this.completionPending = false
                return true
            }

            console.error(`Failed to complete scaffolding for ${targetBuilding.getName()} at ${location.x},${location.y}. Restoring scaffolding.`)
        } catch (error) {
            console.error(`Error completing scaffolding for ${targetBuilding.getName()} at ${location.x},${location.y}. Restoring scaffolding.`, error)
        }

        if (!scaffoldRemoved) {
            return false
        }

        this.sprite = this.createDisplayObject()
        this.sprite.rotation = displayRotation
        this.sprite.pivot.set(this.size.x * BUILD_TILE_HALF_SIZE, this.size.y * BUILD_TILE_HALF_SIZE)

        try {
            if (activeCave.build(this, location, this.sprite)) {
                this.completionPending = true
                return false
            }
        } catch (error) {
            console.error(`Error restoring scaffolding for ${targetBuilding.getName()} at ${location.x},${location.y}.`, error)
            return false
        }

        console.error(`Failed to restore scaffolding for ${targetBuilding.getName()} at ${location.x},${location.y}.`)
        return false
    }

}
