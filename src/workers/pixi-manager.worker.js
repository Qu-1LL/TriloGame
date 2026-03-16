const viewState = {
    creatures: new Map(),
    buildings: new Map()
}

function clearState() {
    viewState.creatures.clear()
    viewState.buildings.clear()
}

function setInitialState(payload) {
    clearState()

    if (Array.isArray(payload.creatures)) {
        for (const creature of payload.creatures) {
            if (!creature || typeof creature.id !== 'string') {
                continue
            }
            viewState.creatures.set(creature.id, {
                id: creature.id,
                location: creature.location ?? null
            })
        }
    }

    if (Array.isArray(payload.buildings)) {
        for (const building of payload.buildings) {
            if (!building || typeof building.id !== 'string') {
                continue
            }
            viewState.buildings.set(building.id, {
                id: building.id,
                location: building.location ?? null
            })
        }
    }
}

function registerCreature(creature) {
    if (!creature || typeof creature.id !== 'string') {
        return
    }
    viewState.creatures.set(creature.id, {
        id: creature.id,
        location: creature.location ?? null
    })
}

function processSimulationUpdates(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
        return
    }

    const commands = []

    for (const update of updates) {
        if (!update || typeof update.type !== 'string') {
            continue
        }

        if (update.type === 'creatureMoved' && typeof update.creatureId === 'string') {
            const existing = viewState.creatures.get(update.creatureId) ?? { id: update.creatureId }
            existing.location = update.location
            viewState.creatures.set(update.creatureId, existing)

            commands.push({
                type: 'moveCreatureSprite',
                creatureId: update.creatureId,
                location: update.location,
                rotation: update.rotation
            })
            continue
        }

        if (update.type === 'buildPlaced' && typeof update.buildingId === 'string') {
            viewState.buildings.set(update.buildingId, {
                id: update.buildingId,
                location: update.location ?? null
            })

            commands.push({
                type: 'buildingPlaced',
                requestId: update.requestId,
                buildingId: update.buildingId,
                location: update.location
            })
            continue
        }

        if (update.type === 'movementBlocked' && typeof update.creatureId === 'string') {
            commands.push({
                type: 'clearCreaturePath',
                creatureId: update.creatureId
            })
        }
    }

    if (commands.length > 0) {
        postMessage({
            type: 'renderCommands',
            commands
        })
    }
}

self.addEventListener('message', (event) => {
    const message = event.data
    if (!message || typeof message.type !== 'string') {
        return
    }

    switch (message.type) {
    case 'init':
        setInitialState(message)
        break
    case 'simulationUpdates':
        processSimulationUpdates(message.updates)
        break
    case 'registerCreature':
        registerCreature(message.creature)
        break
    default:
        break
    }
})
