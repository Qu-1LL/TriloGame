# TriloGame Agent Notes

## Scope
This document reflects the currently implemented gameplay and UI behavior in the codebase under `src/`.

## Documentation Maintenance
- When a new building is implemented, add its data model and workflow to this file in the same change.
- When a new custom game event is implemented, add the event name and exact emission timing to this file in the same change.

## Trilobite Roles And Workflows

### Role: `unassigned`
- Trigger: default state, or any state that falls back from miner/farmer.
- Workflow:
1. Release mining post assignment (if any).
2. Release algae farm assignment (if any).
3. Do no autonomous work until reassigned or given manual movement.

### Role: `miner`
- Trigger:
1. Select a trilobite.
2. Open creature menu.
3. Press `Mine`.
- Workflow (`Trilobite` step chain):
1. Find viable mining posts: post must have inventory space and queued mineable tiles.
2. Prioritize posts by current assignment load, then approach distance.
3. Navigate to selected post area.
4. If carrying resources, deposit to post inventory first.
5. Request and reserve a mineable tile from the post queue.
6. Validate reservation is still valid.
7. Navigate to mining target:
- Ore tiles: stand on tile.
- Wall tiles: stand on an adjacent passable tile.
8. Mine tile:
- `wall` becomes `empty`, new wall perimeter may be generated, trilobite gains `Sandstone`.
- Ore tile becomes `empty`, trilobite gains that ore type.
9. Notify nearby mining posts that mineable tile queues are stale.
10. Loop back to step 1.
- Failure handling:
1. Navigation/mine failure clears queued actions.
2. Reservation is reset/requeued when needed.
3. Behavior restarts from step 1.

### Role: `farmer`
- Trigger:
1. Select a trilobite.
2. Open creature menu.
3. Press `Farm`.
- Workflow (`Trilobite` step chain):
1. If carrying non-`Algae`, clear inventory.
2. If carrying `Algae`, skip to queen delivery.
3. Find viable algae farms (must have an approach tile).
4. Prioritize farms by current assignment load, then approach distance.
5. Assign trilobite to farm and navigate to farm.
6. Build a route that visits passable farm tiles and returns to origin.
7. Move along farm route and attempt harvest at each step.
8. Harvest succeeds when `Math.random() < growth/period`; success gives fixed `harvestYield`.
9. After harvest, navigate to a passable queen tile.
10. Feed queen all carried algae.
11. If queen quota is reached, queen may spawn broodlings and increase next quota.
12. Loop back to step 1.
- Failure handling:
1. If farm/queen unavailable or pathing fails, release assignment and restart selection.
2. Role checks enforce miner/farmer exclusivity on assignments.

### Manual Movement (Role-Agnostic)
- Trigger:
1. Select trilobite.
2. Press `Move`.
3. Hover tiles to preview path.
4. Click destination tile to queue path.
- Runtime:
1. Path steps are enqueued in the creature action queue.
2. Each simulation tick executes one queued action.

## Building Types, Data Types, And Workflows

## Shared Building Data Model (`Building`)
- `name: string`
- `size: { x: number, y: number }`
- `openMap: number[][]`
- `game: Game`
- `tileArray: Tile[]`
- `description: string`
- `sprite: PIXI.Sprite | null`
- `hasStation: boolean`
- `location: { x: number | null, y: number | null }`

### `openMap` semantics during placement
- `0`: tile occupied by building, not passable.
- `1`: tile occupied by building, passable for creatures.
- `>1`: tile skipped by occupancy write in `build` (reserved behavior).

### Building placement workflow (all building types)
1. Creature menu `Build` opens build options.
2. Selecting a building creates an instance via `Factory.build()`.
3. Game enters `buildMode` and shows floating placement sprite.
4. Mouse move updates floating sprite position.
5. `R` rotates sprite and `openMap`.
6. Click empty tile to attempt placement.
7. `Cave.canBuild` validates all required footprint tiles.
8. `Cave.build` writes building occupancy/passability, stores `tileArray`, adds sprite.
9. Optional `onBuilt(cave)` hook runs.
10. `Escape` or successful placement exits active UI state.

### `Factory`
- Purpose: lightweight blueprint wrapper for unlocked buildings.
- Data copied from sample instance:
- `name`, `sprite`, `openMap`, `size`, `description`, `hasStation`.
- Workflow: `Factory.build()` returns a new runtime building instance.

### `Queen`
- Type:
- `size: 3x3`
- `openMap: [[1,1,1],[1,0,1],[1,1,1]]`
- `hasStation: true`
- Runtime data:
- `algaeQuota: number` (starts 20)
- `algaeCount: number`
- `broodlingCount: number`
- Workflow:
1. Farmer feeds algae through `feedAlgae`.
2. Queen accumulates algae.
3. On each quota threshold:
- consume quota amount,
- raise next quota by 5,
- attempt brood spawn on a random passable queen tile.
4. Spawned brood type matches feeder trilobite class.

### `MiningPost`
- Type:
- `size: 3x3`
- `openMap: [[1,1,1],[1,0,1],[1,1,1]]`
- `hasStation: true`
- Runtime data:
- `capacity: number` (1000)
- `radius: number` (10)
- `inventory: Record<string, number>`
- `assignments: Map<Creature, string | null>`
- `mineableQueues: Record<string, string[]>`
- `mineableQueueHeads: Record<string, number>`
- `mineableTypes: string[]`
- queue state flags
- Workflow:
1. `onBuilt` initializes mineable queues for in-radius wall/ore tiles.
2. Miners are assigned to post and optionally to reserved tile keys.
3. Post provides filtered, non-conflicting mining targets.
4. Miner deposits resources via `deposit`.
5. Tile changes invalidate queues; queues lazily rebuild on next use.

### `AlgaeFarm`
- Type:
- `size: 2x3`
- `openMap: [[1,1],[1,1],[1,1]]` (fully passable)
- `hasStation: false`
- Runtime data:
- `period: number` (30)
- `growth: number`
- `harvestYield: number` (5)
- `assignments: Set<Creature>`
- Workflow:
1. Farmers assign to farm.
2. Farm exposes passable tile graph/path for traversal.
3. `growth` increments on each harvest attempt.
4. Harvest succeeds probabilistically based on `growth/period`.
5. On success, algae is transferred to creature inventory and `growth` resets.

### `Storage`
- Type:
- `size: 2x2`
- `openMap: [[0,0],[0,0]]`
- `hasStation: false`
- Runtime data:
- `capacity: number` (20)
- Workflow:
1. Placeable via build menu.
2. No active transfer workflow is currently implemented.

### `Smith`
- Type:
- `size: 2x2`
- `openMap: [[0,0],[0,1]]`
- `hasStation: true`
- Runtime data:
- recipe system not implemented yet.
- Workflow:
1. Placeable via build menu.
2. Crafting interactions are placeholders only.

### `Radar`
- Type:
- `size: 4x4`
- `openMap: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]`
- `hasStation: false`
- Runtime data:
- `radiusMax: number` (starts 50)
- `currentRadius: number` (starts 0)
- `growthChance: number` (`0.1`, or 1 in 10 per tick)
- Workflow:
1. Placeable via build menu and occupies a fully impassable 4x4 footprint.
2. `onBuilt` reveals the radar footprint tiles immediately.
3. On each simulation tick, if `currentRadius < radiusMax`, the radar rolls a 1 in 10 growth chance; failed rolls do no reveal work.
4. On a successful roll, `currentRadius` increases by 1 and only the newly unlocked ring of tiles is revealed.
5. Reveals are tile-by-tile and use Euclidean distance, not cave flood-fill.
6. Distance is checked against the 4 center tiles of the 4x4 footprint, not the top-left anchor tile.
7. Once `currentRadius` reaches `radiusMax`, expansion stops.
8. Revealed tiles remain visible permanently; removing the radar later does not hide them again.

## Object-Oriented Structure (High-Level)

### World graph layer
- `Graph` owns tile map and edge management.
- `Tile` stores base terrain, building occupancy, passability, neighbors, sprite pointer.
- `Cave extends Graph` and adds:
- cave generation,
- tile/building/creature runtime state,
- pathfinding (`bfsPath`),
- movement and spawn rules,
- building placement and reveal logic.

### Unit layer
- `Creature` is the base actor:
- action queue (`NodeQueue`),
- inventory model,
- path queue/path preview,
- navigation helpers,
- generic selection/build interactions.
- `Trilobite extends Creature`:
- role system (`unassigned`, `miner`, `farmer`),
- role-specific multi-step workflows,
- mining/farming assignment state.

### Building layer
- `Building` is the base type for all placeables.
- Subclasses: `Queen`, `MiningPost`, `AlgaeFarm`, `Storage`, `Smith`, `Radar`.
- `Factory` wraps buildable classes for menu/unlock usage.

### UI/controller layer
- `Game` holds global state for selection, drag/zoom, build mode, floating paths/sprites, and active menu.
- `Menu` renders context actions for selected creature/building and build-option overlays.

### Supporting data types
- `Ore` is an enum-like class for resource names.
- `NodeQueue` is a linked-list queue used for deferred creature actions.

## Implemented Events And Input Behavior

### Game runtime events (`Game.emit`)
- `tileMined`:
1. Emitted from the shared mining path in `Game.emitMineEvents`.
2. Fires once whenever a mineable tile is successfully converted to `empty` through `Game.mineTile`.
3. Covers both manual wall mining and trilobite mining of walls or ore tiles.
- `wallMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when the mined tile's pre-mine base was `wall`.
3. Emission happens after the wall tile becomes `empty` and wall-perimeter updates/queue invalidation are applied.
- `AlgaeMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when an `Algae` tile is mined into `empty`.
- `SandstoneMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when a `Sandstone` tile is mined into `empty`.
- `MagnetiteMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when a `Magnetite` tile is mined into `empty`.
- `MalachiteMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when a `Malachite` tile is mined into `empty`.
- `PeroteneMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when a `Perotene` tile is mined into `empty`.
- `IlmeniteMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when an `Ilmenite` tile is mined into `empty`.
- `CochiniumMined`:
1. Emitted from `Game.emitMineEvents`.
2. Fires alongside `tileMined` when a `Cochinium` tile is mined into `empty`.
- Stats linkage:
1. `Stats` subscribes to `tileMined`, `wallMined`, and every `<OreName>Mined` event on `Game`.
2. Each event increments the stat with the same key name.

### Global window events (`main.js`)
- `wheel`:
1. Zoom in/out (`currentScale`) with clamped bounds.
2. Reposition non-floating tile-container children relative to screen center.
- `mousedown`:
1. Capture drag start position.
2. Reset drag flag.
- `mousemove`:
1. If drag exceeds threshold, pan world view.
2. If in `buildMode`, move floating building sprite to cursor.
- `mouseup`:
1. If dragging, commit pan delta into base coordinates.
2. End drag operation.
- `keydown`:
1. `Enter`: run one simulation tick.
2. Tick order: creatures execute queued behavior first, then buildings with `tick()` hooks update.
3. `Space`: toggle auto-tick pause/run.
4. `1`/`2`/`3`/`4`: set tick speed to 500/250/100/50 ms.
5. `P`: log tick state (creatures and mining posts).
6. `Escape`: `game.cleanActive()` (close menus, clear previews, cancel active mode).
7. `R`: if building placement active, rotate floating building and anchor/orientation state.

### Tile events (`Cave` constructor and mining updates)
- Wall tile `mouseup`: mine wall via `game.whenWallMined`.
- Empty/ore tile `mouseup`: routed to `game.emptyTileClicked`.
- Empty/ore tile `pointerover`: routed to `game.emptyTileHover` for move-path preview.
- Empty/ore tile `pointerout`: routed to `game.emptyTileHoverExit`.
- Newly created wall tiles after mining also receive wall `mouseup`.
- Newly mined wall-to-empty tiles receive empty-tile click/hover handlers.

### Creature sprite events (`Creature`)
- `mouseup` on trilobite sprite:
1. Ignored during drag/build mode.
2. Toggle select/deselect of same creature.
3. Replace existing selection with this creature and open creature menu.

### Building sprite proxy events (`Cave.build`)
- `pointermove`: forwards hover behavior to underlying footprint tile.
- `mouseup`:
1. Ignored while dragging.
2. Forwards click to underlying footprint tile event first.
3. If no carry mode active (`movePath`/`buildMode`), selects the building.
- `pointerout`: forwards pointer-out to underlying footprint tile.

### Menu/button events (`Menu`)
- Creature menu:
1. `Move` button `mouseup`: enter move-path mode and clear committed path preview.
2. `Build` button `mouseup`: re-open menu as build options menu.
3. `Mine` button `mouseup`: set role to miner, clear queue, enqueue miner behavior, close active UI.
4. `Farm` button `mouseup`: set role to farmer, clear queue, enqueue farmer behavior, close active UI.
- Build options menu:
1. Building option `pointerover`: show right-panel preview sprite + size/description.
2. Building option `pointerout`: clear hover preview panel.
3. Building option `mouseup`: create floating building instance and enter placement mode.

### Hover-specific behavior
- During move mode, hovering passable tile outside menu panel previews BFS path from selected creature.
- Leaving tile hover clears floating preview paths.
- Hover previews are suppressed while dragging/build mode is active.

## Menu System: Implemented Menus And Flow

### Selection-driven menu creation
1. Selecting a creature/building calls `Game.selected.setSelected`.
2. Existing active UI state is cleaned first (`cleanActive`).
3. New `Menu` instance is created and opened on `uiContainer`.
4. Selection visuals:
- Creature: single selection sprite centered on creature + queued path display.
- Building: perimeter edge highlight sprites around non-shared boundaries.

### Creature menu flow
1. Header/title and coordinate card are shown.
2. Action buttons shown: `Move`, `Build`, `Mine`, `Farm`.
3. Branches:
- `Move` branch: path preview/commit workflow on map tiles.
- `Build` branch: transitions to build-options list.
- `Mine`/`Farm` branch: immediate role assignment and autonomous loop start.

### Build-options menu flow
1. Lists all buildables returned by `creature.getBuildable()` (from `game.unlockedBuildings`).
2. Hovering an option shows contextual building info preview.
3. Clicking an option enters placement workflow with floating sprite.
4. Placement click on valid tile commits build; invalid tile keeps placement active.
5. `Escape` exits the flow and clears floating state.

### Building menu flow
- `buildingMenu()` exists but currently has placeholder comments only.
- Buildings can be selected; no building-specific interaction UI is implemented yet.

### Menu/Game state interaction
- `cleanActive()` is the central reset:
1. Destroys floating path sprites and building edge highlights.
2. Exits move/build modes.
3. Removes floating building sprite.
4. Closes and destroys active menu sprites.
5. Clears selected object and selected-path overlays.
- Several workflows call `cleanActive()` to prevent mode overlap and stale UI.
