# TriloGame Agent Notes

## Scope
This document reflects the currently implemented gameplay and UI behavior in the codebase under `src/`.

## Documentation Maintenance
- When a new building is implemented, add its data model and workflow to this file in the same change.
- When a new custom game event is implemented, add the event name and exact emission timing to this file in the same change.
- When creature, tile, building, or UI state/workflow changes under `src/`, update the relevant sections of this file in the same change.

## Trilobite Roles And Workflows

### Role: `unassigned`
- Trigger: default state, or any state that falls back from miner/farmer/fighter.
- Workflow:
1. Release `assignedBuilding` if it currently points to a mining post, algae farm, or barracks.
2. Clear any stored fighter target.
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
5. Store the target farm in `assignedBuilding` and navigate to farm.
6. Build a route that visits passable farm tiles and returns to origin.
7. Move along farm route and attempt harvest at each step.
8. Harvest succeeds when `Math.random() < growth/period`; success gives fixed `harvestYield`.
9. After harvest, follow the shared queen BFS field one tile at a time until standing on a passable queen tile.
10. Feed queen all carried algae.
11. If queen quota is reached, queen may spawn broodlings and increase next quota.
12. Loop back to step 1.
- Failure handling:
1. If farm/queen unavailable or pathing fails, release assignment and restart selection.
2. Role checks enforce miner/farmer exclusivity through the shared `assignedBuilding` slot.

### Role: `fighter`
- Trigger:
1. Select a trilobite.
2. Open creature menu.
3. Press `Fight`.
- Workflow (`Trilobite` step chain):
1. If `game.danger` is `false`, clear the fighter target and prefer returning to an assigned barracks.
2. If no barracks is assigned, pick a barracks by lowest assignment load, then approach distance, and store it in `assignedBuilding`.
3. If already on a passable barracks tile, idle there until danger rises.
4. If `game.danger` is `true` and the stored target tile is adjacent, attack the enemy on that tile.
5. If a neighboring tile contains an enemy, set that tile as the fighter target and attack.
6. Otherwise, read the current `enemy` BFS field and move one tile to a neighboring passable tile with a lower value.
7. Fighters recompute their adjacent-enemy checks before and after each combat move so movement can still be interrupted for attacks.
8. If no reachable enemy exists while danger is active, navigate back to the least-loaded barracks and rejoin its assignment set.
- Failure handling:
1. Losing the target enemy clears the fighter target and triggers a fresh enemy search.
2. Failed combat movement clears queued fighter steps and restarts from step 1.
3. Role checks enforce that only barracks remain in `assignedBuilding` while fighter behavior is active.

### Enemy Behavior
- Trigger: `Enemy` creatures spawn with `assignment = 'enemy'`.
- Workflow (`Enemy` step chain):
1. If the stored hostile tile is adjacent, attack the trilobite or building on that tile.
2. Otherwise, check neighboring tiles for a trilobite first, then for a building; if found, store that tile as the target and attack.
3. Otherwise, read the current `colony` BFS field, which is seeded from trilobites plus adjacent tiles around non-passable colony-building tiles, and move one tile to a neighboring passable tile with a lower value.
4. Enemy movement re-checks target validity and adjacent trilobites/buildings before and after moving so travel can still be interrupted for combat.
5. If no lower-value colony tile is reachable, do nothing.
- Failure handling:
1. Losing the target trilobite/building clears the stored target and triggers a fresh hostile search.
2. Failed combat movement clears queued enemy steps and restarts from step 1.

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
- `health: number` (starts 100)
- `maxHealth: number` (starts 100)
- `health: number` (starts 100)
- `maxHealth: number` (starts 100)

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
11. Buildings can take damage through `takeDamage`; at `0` health they are removed from the cave and their footprint becomes passable again.
11. Buildings can take damage through `takeDamage`; at `0` health they are removed from the cave and their footprint becomes passable again.

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

### `Barracks`
- Type:
- `size: 3x3`
- `openMap: [[1,1,1],[1,0,1],[1,1,1]]`
- `hasStation: true`
- Runtime data:
- `assignments: Set<Creature>`
- Workflow:
1. Placeable via build menu.
2. Fighters sort barracks by assignment count, then approach distance.
3. A fighter stores its selected barracks in `assignedBuilding`.
4. When danger is low or no reachable enemies exist, fighters return to a passable barracks tile and idle there.

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
- `Tile` stores base terrain, building occupancy, passability, current trilobite occupants, neighbors, sprite pointer.
- `Cave extends Graph` and adds:
- cave generation,
- tile/building/creature runtime state,
- `revealedTiles`, a live `Set<Tile>` tracking every revealed tile including revealed walls,
- `revealedTiles`, a live `Set<Tile>` tracking every revealed tile including revealed walls,
- `revealedTiles`, a live `Set<Tile>` tracking every revealed tile including revealed walls,
- pathfinding (`bfsPath`),
- game-held BFS distance fields for `enemy`, `colony`, and `queen`, computed only over revealed tiles,
- full rebuilds of the `enemy` and `colony` fields during combat-phase handoff,
- incremental BFS-field rebalancing when buildings are placed, walls are mined, or creatures spawn,
- creature deaths rely on the next combat-phase BFS rebuild instead of triggering an immediate rebalance,
- movement, spawn, and removal rules,
- danger-state syncing for enemy spawn/death, including clearing `game.danger` when the last enemy is removed,
- full-party healing for all remaining creatures when the last enemy is removed,
- trilobite tile-occupancy syncing during spawn/move/removal,
- building placement and reveal logic.

### Unit layer
- `Creature` is the base actor:
- action queue (`NodeQueue`),
- path queue/path preview,
- combat state (`health`, `maxHealth`, `damage`) and basic damage/death handling,
- navigation helpers,
- sprite-placement helper that snaps movers to the destination tile center and then applies a fresh random 1-15 px radial offset on each completed move,
- generic selection/build interactions.
- `Trilobite extends Creature`:
- inventory model,
- role system (`unassigned`, `miner`, `farmer`, `fighter`),
- role-specific multi-step workflows,
- shared `assignedBuilding` state for mining/farming/barracks assignments,
- `pendingMineTileKey` for reserved mining targets.
- `fighterTargetTileKey` for the current enemy tile target.
- `Enemy extends Creature`:
- autonomous combat workflow that attacks adjacent trilobites or buildings and otherwise follows the shared colony BFS field toward trilobites or non-passable colony-building targets,
- `enemyTargetTileKey` for the current hostile tile target.

### Building layer
- `Building` is the base type for all placeables.
- Subclasses: `Queen`, `MiningPost`, `AlgaeFarm`, `Barracks`, `Storage`, `Smith`, `Radar`.
- `Factory` wraps buildable classes for menu/unlock usage.

### UI/controller layer
- `Game` holds global state for selection, drag/zoom, build mode, floating paths/sprites, paused BFS-debug overlays, active menu, and `danger`.
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
1. `Enter`: run one simulation tick and refresh the active BFS debug overlay if one is being shown.
2. Tick order:
- If `game.danger` is `true`, rebuild the `enemy` BFS field, process all non-enemy creatures once, rebuild the `colony` BFS field, process all enemies once, then run buildings with `tick()` hooks.
- If `game.danger` is `false`, do not rebuild either combat BFS field; process non-enemy creatures once so fighters can return to barracks or idle, skip enemy processing, then run buildings with `tick()` hooks.
3. `Space`: call `game.cleanActive()` and then toggle auto-tick pause/run.
4. While paused, `1`/`2`/`3` display the `queen`/`enemy`/`colony` BFS field as centered yellow tile labels; finite distances are shown and blocked or unreachable revealed tiles are left blank; `4` does nothing.
5. While unpaused, `1`/`2`/`3`/`4` set tick speed to 500/250/100/50 ms.
6. `P`: spawn a debug enemy on a random revealed, passable, unoccupied tile if one exists, then log tick state (creatures and mining posts).
7. `Escape`: `game.cleanActive()` (close menus, clear previews, cancel active mode, clear BFS debug labels).
8. `R`: if building placement active, rotate floating building and anchor/orientation state.
9. Hold `W`/`A`/`S`/`D` to continuously pan the world at 800 screen px/s by applying the same base-position camera offset updates used by click-and-drag panning.
- `keyup`:
1. Releasing `W`/`A`/`S`/`D` clears that held pan direction.
- `blur`:
1. Clears all held `W`/`A`/`S`/`D` pan directions so camera movement cannot stick after window focus is lost.

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
5. `Fight` button `mouseup`: set role to fighter, clear queue, enqueue fighter behavior, close active UI.
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
2. Action buttons shown: `Move`, `Build`, `Mine`, `Farm`, `Fight`.
3. Branches:
- `Move` branch: path preview/commit workflow on map tiles.
- `Build` branch: transitions to build-options list.
- `Mine`/`Farm`/`Fight` branch: immediate role assignment and autonomous loop start.

### Build-options menu flow
1. Lists all buildables returned by `creature.getBuildable()` (from `game.unlockedBuildings`, including `Barracks`).
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
2. Clears any active BFS debug overlay labels.
3. Exits move/build modes.
4. Removes floating building sprite.
5. Closes and destroys active menu sprites.
6. Clears selected object and selected-path overlays.
- Several workflows call `cleanActive()` to prevent mode overlap and stale UI.
