# TriloGame Agent Notes

## Scope
This document reflects the currently implemented gameplay and UI behavior in the codebase under `src/`.

## Documentation Maintenance
- When a new building is implemented, add its data model and workflow to this file in the same change.
- When a new custom game event is implemented, add the event name and exact emission timing to this file in the same change.
- When creature, tile, building, or UI state/workflow changes under `src/`, update the relevant sections of this file in the same change.

## Trilobite Roles And Workflows

### Role: `unassigned`
- Trigger: default state, or any state that falls back from miner/farmer/builder/fighter.
- Workflow:
1. Release `assignedBuilding` if it currently points to a mining post, algae farm, scaffolding, or barracks.
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
3. Navigate to selected post area via the mining post's cached BFS field.
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
5. Store the target farm in `assignedBuilding` and navigate to farm via that farm's cached BFS field.
6. Build a route that visits passable farm tiles and returns to origin.
7. Move along farm route and attempt harvest at each step.
8. Harvest succeeds when `Math.random() < growth/period`; success gives fixed `harvestYield`.
9. After harvest, follow the queen building's cached BFS field one tile at a time until standing on a passable queen tile.
10. Feed queen all carried algae.
11. If queen quota is reached, queen may spawn broodlings and increase next quota.
12. Loop back to step 1.
- Failure handling:
1. If farm/queen unavailable or pathing fails, release assignment and restart selection.
2. Role checks enforce miner/farmer exclusivity through the shared `assignedBuilding` slot.

### Role: `builder`
- Trigger:
1. Select a trilobite.
2. Open creature menu.
3. Press `Builder`.
- Workflow (`Trilobite` step chain):
1. Pick or keep an in-progress scaffolding by lowest current builder assignment count, then by building-BFS distance.
2. If carrying a resource the assigned scaffolding still needs, navigate into scaffold work range and deposit it.
3. If carrying a resource the assigned scaffolding no longer needs, return it to the nearest mining post with free space.
4. If the scaffolding still needs resources after accounting for builder-held reservations, sort mining posts by the BFS value of the trilobite's current tile in each post's cached field.
5. Check those posts shortest-to-longest for a resource whose unreserved inventory can satisfy one of the scaffolding's still-unreserved recipe needs.
6. Immediately reserve that material/amount on both the scaffolding and the chosen mining post.
7. Navigate to the reserved mining post, withdraw the reserved material into inventory, and clear the mining-post-side reservation.
8. Navigate back into scaffold work range and deposit the carried material into the scaffolding.
9. Builders only apply construction work after the full recipe has been deposited into that scaffold.
10. If a scaffold has no actionable next step for the current builder, that trilobite releases it and can retarget another in-progress scaffold instead of idling permanently on the old one.
11. Scaffolding completes only when both recipe deposits and rarity-weighted construction work are finished.
12. Loop back to step 1 while any scaffolding remains in progress.
- Failure handling:
1. Invalid or completed scaffolding releases builder assignments and scaffold-side reservations.
2. Invalid mining-post reservations are cleared and the builder restarts target selection.
3. If a scaffold is fully supplied/worked but still present because the final building swap failed, builders retry the scaffold completion path instead of treating it as permanently done.
4. Navigation failure clears queued builder steps and restarts from step 1.

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
8. If no reachable enemy exists while danger is active, navigate back to the least-loaded barracks using its cached BFS field and rejoin its assignment set.
- Failure handling:
1. Losing the target enemy clears the fighter target and triggers a fresh enemy search.
2. Failed combat movement clears queued fighter steps and restarts from step 1.
3. Role checks enforce that only barracks remain in `assignedBuilding` while fighter behavior is active.

### Enemy Behavior
- Trigger: `Enemy` creatures spawn with `assignment = 'enemy'`.
- Workflow (`Enemy` step chain):
1. If the stored hostile tile is adjacent, attack the trilobite or building on that tile.
2. Otherwise, check neighboring tiles for a trilobite first, then for a building; if found, store that tile as the target and attack.
3. Otherwise, read the current `colony` BFS field, which is seeded from trilobites plus adjacent tiles around non-passable colony-building tiles and the outside perimeter of algae farms, and move one tile to a neighboring passable tile with a lower value.
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
1. Hover/click path generation uses a temporary destination-seeded distance field rather than direct source-to-goal BFS.
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
- `bfsField: BfsField`
- `bfsField.field: Map<string, number>`
- `bfsField.updatedTiles: Set<string>`
- `bfsField.updatedBuildings: Set<Building>`
- `bfsField.updatedCreatures: Set<Creature>`
- `bfsField.trackedBuildings: Set<Building>`
- `bfsField.trackedCreatures: Set<Creature>`
- `displayBaseSize: { x: number, y: number }` (unrotated display footprint used for sprite pivot math)
- `displayRotationTurns: number` (quarter-turn clockwise rotation state for the building's visual display)
- `recipe: Record<string, number> | null` (construction cost for scaffolded buildables)
- `selectable: boolean` (`false` only for runtime buildings that should ignore normal building selection/menu flow)

### `openMap` semantics during placement
- `0`: tile occupied by building, not passable.
- `1`: tile occupied by building, passable for creatures.
- `>1`: tile skipped by `Cave.canBuild` and occupancy write in `build` (reserved behavior).

### Building placement workflow (all building types)
1. Top-right `Menu` button opens the shared main menu panel while it is closed.
2. Player opens the `Buildings` tab directly.
3. Clicking a building card creates the real target instance via `Factory.build()`, then wraps it in a `Scaffolding` instance.
4. If a previous placement preview is already active, it is destroyed before the new building card starts placement.
5. Game enters `buildMode` and shows the floating final-building sprite while keeping the scaffolding instance as the object that will actually be placed.
6. Mouse move updates the floating preview position.
7. `R` rotates the floating final-building preview and the underlying scaffolding/target-building footprint together.
8. Floating preview pivot math uses the target building's unrotated display footprint so the cursor stays bound to the same top-left placement tile across quarter-turn rotations, including non-square buildings.
9. Click empty tile to attempt placement.
10. `Cave.canBuild` validates all non-`>1` footprint tiles, rejects placement if any trilobite is currently occupying one of those footprint tiles, and, once the queen exists, requires every occupied footprint tile to be in the queen-connected reachable-tile set.
11. On player placement click, build validation also runs a simulated reachability pass: it duplicates the current `reachableTiles` set, removes every `0`/`1` footprint tile of the candidate placement from that simulated set, then flood-fills outward from the queen footprint; placement is rejected if any previously reachable tile would become disconnected.
12. The same simulated placement check also requires every currently accessible existing building to retain at least one reachable interior tile or reachable adjacent approach tile, so new construction cannot fully box in an older building.
13. `Cave.build` writes building occupancy/passability, stores `tileArray`, reapplies the building's stored quarter-turn display rotation, and adds the building display object using pivot-based placement for both sprites and multi-cell scaffold containers.
14. Optional `onBuilt(cave)` runs only for the building instance actually being placed. Scaffolding placement does not trigger the target building's `onBuilt`.
15. When scaffolding reaches its recipe requirement, it removes itself and places the stored target building at the same top-left tile and preserved quarter-turn rotation; the final target's `onBuilt(cave)` runs at that moment.
16. Successful placement exits build mode and clears the current selection/preview state without automatically closing the shared menu panel; `Escape` exits active UI state and also closes the panel.
17. Buildings can take damage through `takeDamage`; at `0` health they are removed from the cave, their footprint becomes passable again, and any affected trilobites clear stale assignment/reservation state, release destroyed-building links such as `assignedBuilding` or `builderSourcePost`, and restart their current role behavior.

### `Factory`
- Purpose: lightweight blueprint wrapper for unlocked buildings.
- Data copied from sample instance:
- `name`, `sprite`, `openMap`, `size`, `description`, `hasStation`.
- Workflow: `Factory.build()` returns a new runtime building instance.

### `Scaffolding`
- Type:
- `size`: mirrors the stored target building.
- `openMap`: rebuilt from the target building so every `0` or `1` target cell becomes scaffold `0`, while target cells `>1` stay skipped.
- `hasStation: false`
- `selectable: true`
- Runtime data:
- `targetBuilding: Building`
- `recipeRequired: Record<string, number>`
- `recipeDeposited: Record<string, number>`
- `recipeComplete: boolean`
- `materialReservations: Map<Creature, { resourceType: string, amount: number }>`
- `assignments: Set<Creature>`
- `constructionProgress: number`
- `constructionRequired: number` (recipe-weighted by material amount and ore rarity)
- `constructionComplete: boolean`
- `completionPending: boolean` (true when recipe/work are complete but the final building swap still needs to succeed)
- `sprite`: `PIXI.Container` root with one `Scaffold` tile sprite per occupied scaffold cell.
- Workflow:
1. Constructed automatically from a real target building chosen in the build menu; it is not part of `game.unlockedBuildings`.
2. Rotating the floating scaffold also rotates the stored target building and regenerates the scaffold footprint/display from the rotated target `openMap`.
3. Scaffolding stores the target building's quarter-turn visual rotation separately from its own rebuilt tile footprint so the final building sprite keeps the same orientation when construction completes.
4. While placed, scaffolding blocks the full final occupied footprint, even where the eventual target would be passable.
5. Builders reserve outstanding recipe needs on scaffolding through `materialReservations` so multiple carriers cannot over-claim the same missing material.
6. `deposit()` only accepts resources that still have remaining requirement, clamps the accepted amount to that remainder, and clears that builder's scaffold-side reservation.
7. `getRecipeProgress()` returns cloned required/deposited/remaining counts plus reserved totals and construction-progress state.
8. `applyConstructionWork()` advances rarity-weighted build progress separately from material deposits.
9. `completeConstruction()` only succeeds once both recipe deposits and construction progress are complete; then it removes the scaffold and places the stored target at the same top-left location and preserved rotation through normal `Cave.build` logic.
10. If scaffolding is destroyed before completion, the stored target is discarded and no final building is placed.
11. If final placement fails during completion, the scaffold rebuilds itself at the same location, preserves progress and rotation state, and remains retryable instead of becoming a dead completed scaffold.

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
- `recipe: { Sandstone: 20 }`
- `capacity: number` (1000)
- `radius: number` (10)
- `inventory: Record<string, number>`
- `assignments: Map<Creature, string | null>`
- `materialReservations: Map<Creature, { resourceType: string, amount: number }>`
- `mineableQueues: Record<string, string[]>`
- `mineableQueueHeads: Record<string, number>`
- `mineableTypes: string[]`
- queue state flags
- Workflow:
1. `onBuilt` initializes mineable queues for in-radius wall/ore tiles.
2. Miners are assigned to post and optionally to reserved tile keys.
3. Post provides filtered, non-conflicting mining targets.
4. Miner deposits resources via `deposit`.
5. Builders compare post inventory against `materialReservations`, reserve material on a chosen post without decrementing inventory immediately, and only reduce inventory when they call `withdrawReservedMaterial`.
6. Tile changes invalidate queues; queues lazily rebuild on next use.

### `AlgaeFarm`
- Type:
- `size: 2x3`
- `openMap: [[1,1],[1,1],[1,1]]` (fully passable)
- `hasStation: false`
- Runtime data:
- `recipe: { Sandstone: 20 }`
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
- `recipe: { Sandstone: 20 }`
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
- `recipe: { Sandstone: 20 }`
- `capacity: number` (20)
- Workflow:
1. Implemented as a building type, but not currently included in the default `game.unlockedBuildings` build menu list.
2. No active transfer workflow is currently implemented.

### `Smith`
- Type:
- `size: 2x2`
- `openMap: [[0,0],[0,1]]`
- `hasStation: true`
- Runtime data:
- `recipe: { Sandstone: 20 }`
- crafting recipe system not implemented yet.
- Workflow:
1. Implemented as a building type, but not currently included in the default `game.unlockedBuildings` build menu list.
2. Crafting interactions are placeholders only.

### `Radar`
- Type:
- `size: 4x4`
- `openMap: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]`
- `hasStation: false`
- Runtime data:
- `recipe: { Sandstone: 20 }`
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
- tile/building runtime state plus separate `trilobites` and `enemies` creature sets,
- `revealedTiles`, a live `Set<Tile>` tracking every revealed tile including revealed walls,
- `reachableTiles`, a live `Set<Tile>` tracking the currently passable tiles connected to the queen building's passable footprint,
- wall mining explicitly reveals the newly emptied tile, and if that opening touches a passable tile that was previously unreachable, the newly connected cave section is reprocessed so its passable tiles join `reachableTiles` and its newly accessible boundary tiles join `revealedTiles`, even when radar had already made some of that section visible,
- temporary destination-seeded distance-field generation for manual movement and non-building targets,
- per-building lazy `BfsField` objects over reachable tiles only,
- game-held `BfsField` objects for `enemy` and `colony`, computed only over revealed tiles,
- dirty tile/building/creature tracking on every `BfsField`,
- incremental `BfsField` refreshes that rebalance around dirty tiles instead of recreating the whole map by default,
- shared combat-field dirtying on creature spawn/move/removal and on tile/building/reveal changes,
- reachable-tile recomputation when buildings are placed/removed or wall mining changes passable connectivity,
- creature deaths mark shared combat fields dirty, remove that creature from every building assignment/material-reservation collection, and are applied on the next field refresh/access,
- movement, spawn, and removal rules, including denying spawns onto unreachable tiles,
- danger-state syncing for enemy spawn/death, including clearing `game.danger` when the last enemy is removed,
- full-party healing for all remaining trilobites when the last enemy is removed,
- trilobite tile-occupancy syncing during spawn/move/removal,
- building placement and reveal logic.

### Unit layer
- `Creature` is the base actor:
- action queue (`NodeQueue`),
- path queue/path preview,
- combat state (`health`, `maxHealth`, `damage`) and basic damage/death handling,
- behavior restart helper used after assignment/target cleanup,
- navigation helpers that reconstruct routes from distance fields instead of direct `bfsPath` calls,
- sprite-placement helper that snaps movers to the destination tile center and then applies a fresh random 1-15 px radial offset on each completed move,
- generic selection/build interactions.
- `Trilobite extends Creature`:
- inventory model,
- role system (`unassigned`, `miner`, `farmer`, `builder`, `fighter`),
- role-specific multi-step workflows,
- building navigation via the assigned building's lazy cached BFS field,
- shared `assignedBuilding` state for mining/farming/scaffolding/barracks assignments,
- `builderSourcePost` for the currently reserved mining-post pickup,
- `pendingMineTileKey` for reserved mining targets.
- `fighterTargetTileKey` for the current enemy tile target.
- `Enemy extends Creature`:
- autonomous combat workflow that attacks adjacent trilobites or buildings and otherwise follows the shared colony BFS field toward trilobites, non-passable colony-building targets, and the outside perimeter of algae farms,
- `enemyTargetTileKey` for the current hostile tile target.

### Building layer
- `Building` is the base type for all placeables.
- Subclasses: `Queen`, `MiningPost`, `AlgaeFarm`, `Barracks`, `Storage`, `Smith`, `Radar`, `Scaffolding`.
- `Factory` wraps buildable classes for menu/unlock usage.

### UI/controller layer
- `Game` holds global state for selection, drag/zoom, build mode, floating paths/sprites, paused BFS-debug overlays, the shared top-right menu panel, and `danger`.
- `Menu` renders the shared toggleable main panel with `Buildings` and `Assignments` tabs plus the top-right menu button.

### Supporting data types
- `Ore` is an enum-like class for resource names.
- `NodeQueue` is a linked-list queue used for deferred creature actions.
- `BfsField` owns tracked-target bookkeeping, dirty update queues, cached distance maps, and field/path accessors for building/combat BFS.

## Initial Colony Setup (`main.js`)
- Startup placement workflow:
1. The game places the queen first.
2. Startup also places one finished mining post through normal `Cave.build` logic instead of scaffolding.
3. The starter mining post must fit on reachable tiles, stay at least 5 Manhattan tiles away from any wall/void across its occupied footprint, and have its center within 10 Manhattan tiles of the queen center.
4. If a random queen placement does not allow such a mining post, startup retries queen placement and falls back to an exhaustive search if needed.
5. After the starter buildings are placed, the four initial trilobites spawn on queen tiles.

## Implemented Events And Input Behavior

### Game runtime events (`Game.emit`)
- `trilobiteSpawned`:
1. Emitted from `Cave.spawn` after a non-enemy creature is successfully added to `cave.trilobites`, given its spawn location, and attached to the cave/game sprite state.
2. Fires for successful starter trilobite spawns and queen broodling spawns.
3. Payload includes the spawned `creature`, its `cave`, `tileKey`, `location`, and current `assignment`.
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
1. `Stats` subscribes to `trilobiteSpawned`, `tileMined`, `wallMined`, and every `<OreName>Mined` event on `Game`.
2. Each event increments the stat with the same key name.

### Global window events (`main.js`)
- Canvas `wheel`:
1. If the cursor is over the shared menu panel, world zoom is suppressed.
2. If the cursor is inside a scrollable menu box, the wheel scrolls that specific box instead of zooming the world.
3. Otherwise, zoom in/out (`currentScale`) with clamped bounds.
4. World zoom repositions non-floating tile-container children relative to screen center.
- `resize`:
1. The PIXI renderer resizes live to the browser window while the game is running.
2. The canvas size is derived from `document.documentElement.clientWidth/clientHeight` instead of raw `window.innerWidth/innerHeight`, so browser scrollbars are excluded from the game viewport.
3. `Game.handleViewportResize` preserves the current on-screen world layout while updating the viewport center, menu layout, and any active BFS debug overlay.
- `mousedown`:
1. Capture drag start position.
2. Reset drag flag.
- `mousemove`:
1. If drag exceeds threshold, pan world view.
2. If in `buildMode`, move the floating target-building preview to the cursor.
- `mouseup`:
1. If dragging, commit pan delta into base coordinates.
2. End drag operation.
- `keydown`:
1. `Enter`: run one simulation tick and refresh the active BFS debug overlay if one is being shown.
2. Tick order:
- If `game.danger` is `true`, refresh the dirty `enemy` `BfsField`, process every trilobite in `cave.trilobites` once, refresh the dirty `colony` `BfsField`, process every enemy in `cave.enemies` once, then run buildings with `tick()` hooks.
- If `game.danger` is `false`, do not refresh either combat field automatically; process every trilobite in `cave.trilobites` once so fighters can return to barracks or idle, skip enemy processing, then run buildings with `tick()` hooks.
3. `Space`: call `game.cleanActive()` and then toggle auto-tick pause/run.
4. While paused, `1`/`2`/`3` display the queen building field / `enemy` field / `colony` field as centered yellow tile labels; finite distances are shown and blocked or unreachable revealed tiles are left blank; `4` does nothing.
5. While unpaused, `1`/`2`/`3`/`4` set tick speed to 500/250/100/50 ms.
6. `P`: spawn a debug enemy on a random reachable, passable, unoccupied tile if one exists, then log tick state (trilobites, enemies, and mining posts).
7. `Escape`: `game.cleanActive({ closeMenu: true })` (close the shared menu panel, clear previews, cancel active mode, clear selection, and clear BFS debug labels).
8. `R`: if building placement is active, rotate the floating display plus the underlying building/scaffolding `openMap` and update the pivot/orientation state used for tile-aligned placement.
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
3. Replace existing selection with this creature and open the shared menu panel while preserving whichever main tab is already active.

### Building sprite proxy events (`Cave.build`)
- `pointermove`: forwards hover behavior to underlying footprint tile.
- `mouseup`:
1. Ignored while dragging.
2. Forwards click to underlying footprint tile event first.
3. If no carry mode is active and the placed building is selectable, selects the building.
- `pointerout`: forwards pointer-out to underlying footprint tile.

### Menu/button events (`Menu`)
- Top-right menu button:
1. `pointerup`: open the shared main menu panel.
2. The button is only rendered while the panel is closed; there is no in-panel hide button.
- Main menu tabs:
1. Left tab is `Buildings`.
2. Middle tab is `Assignments`.
3. A third `Selected` tab is rendered only while a trilobite or building is currently selected.
4. `pointerup` on any visible tab switches the panel content in place.
- `Buildings` tab:
1. Shows buildable factories from the selected creature when available, otherwise from `game.unlockedBuildings`.
2. The top half of the tab is a persistent preview card that shows the currently hovered or selected building's name, size, sprite, and description.
3. The lower half of the tab is a scrollable building-grid container with a broad wheel-hit area covering the whole box, not just the masked inner viewport.
4. The grid is 4 cards wide.
5. Each card is rendered as a square and shows only the building name and sprite preview; the card name shrinks to fit without overflowing.
6. Hovering a card updates the preview card immediately.
7. Clicking a card keeps that building selected in the preview, creates the target building, wraps it in scaffolding, and enters placement mode with the target building sprite attached to the cursor.
8. If a placement preview is already active, the old floating preview plus its pending scaffolding state are destroyed before the new one starts.
- `Assignments` tab:
1. Top row contains four assignment filter tabs: `Miner`, `Builder`, `Farmer`, and `Fighter`.
2. The upper box shows the count for the currently selected assignment filter.
3. The lower box shows the count for `unassigned` trilobites.
4. Each box is scrollable when the cursor is hovering inside that box.
5. Each box entry shows a trilobite image with its count beside it.
6. Clicking an entry in the upper box moves one trilobite from the selected assignment back to `unassigned`.
7. Clicking an entry in the lower box moves one trilobite from `unassigned` into the currently selected assignment.
8. Each transfer immediately updates the creature's actual runtime assignment and requeues its corresponding behavior.
9. The tab refreshes in real time when an unassigned trilobite is spawned via the `trilobiteSpawned` event, so the lower-box count updates without waiting for another menu action.
- `Selected` tab:
1. Only appears while `Menu.selectedObject` is not `null`.
2. Shows the selected trilobite or building name plus a delete button.
3. Pressing the delete button uses the normal creature/building `removeFromGame` flow and clears the current selection afterward.

### Hover-specific behavior
- During move mode, hovering a passable tile outside the open menu panel and outside the top-right menu button previews BFS path from the selected creature.
- While the `Buildings` tab is open, hovering a building card updates the top preview card to that hovered building.
- Leaving a building card reverts the preview to the last clicked building card, or to the first available buildable when nothing has been clicked yet.
- Leaving tile hover clears floating preview paths.
- Hover previews are suppressed while dragging/build mode is active.

## Menu System: Implemented Menus And Flow

### Shared menu structure
1. `Game` owns one persistent `Menu` instance on `uiContainer`.
2. While the panel is closed, the menu renders a top-right `Menu` button; opening the panel replaces that button with a full-height right-side panel.
3. The panel always has `Buildings` and `Assignments`, and conditionally adds `Selected` while a trilobite or building is selected.
4. If the active tab disappears because the current selection was cleared or deleted, the menu falls back to `Buildings`.
5. The panel content is redrawn in place when the active tab or current selection changes instead of creating a new menu object per selection.
6. The panel width stays effectively fixed at its standard narrow size, while button sizing, padding, section spacing, and internal panel layout scale from screen height.

### Selection-driven menu flow
1. Selecting a creature/building calls `Game.selected.setSelected`.
2. Selection visuals are rebuilt first:
- Creature: single selection sprite centered on the creature plus its queued path display.
- Building: perimeter edge highlight sprites around non-shared boundaries.
3. The selected object is pushed into the shared `Menu`.
4. The shared panel opens while preserving the current main-tab choice.
5. The camera recenters while accounting for the width of the open right-side panel.

### Selection impact on the menu
1. Selection adds the conditional `Selected` tab to the shared panel.
2. A selected creature still affects the `Buildings` tab because that tab prefers `creature.getBuildable()` when a creature is selected.
3. The `Assignments` tab reads from the colony-wide trilobite set on the cave rather than from the currently selected object.
4. Deleting the selected object through the `Selected` tab uses the normal runtime removal path and then clears the selection.

### `Buildings` tab flow
1. Lists buildable factories from the selected creature when one is selected; otherwise it falls back to `game.unlockedBuildings`.
2. The top preview card shows the currently hovered building, or the last clicked building when nothing is hovered.
3. Inside that preview card, the name/size/description are on the left side and the building image fills the full right half.
4. The bottom build list is rendered as a 4-column scrollable grid of square cards.
5. Each grid card shows only the building name and its sprite preview.
6. Mouse-wheel scrolling is captured while the cursor is anywhere over the building-list box, including its padding and scrollbar area.
7. Clicking a card starts placement immediately and reuses the shared panel instead of opening a second build-options menu.
8. Placement click on a valid tile commits build; invalid placement, including when any occupied `0`/`1` footprint tile currently contains a trilobite, keeps the current preview active.

### `Assignments` tab flow
1. Shows four assignment filter tabs across the top: `Miner`, `Builder`, `Farmer`, `Fighter`.
2. The top box lists the count of trilobites currently in the chosen assignment.
3. The bottom box lists the count of unassigned trilobites.
4. Both boxes are independently scrollable, and the wheel is captured anywhere inside each framed box.
5. Clicking an upper-box entry moves one trilobite from that assignment back to `unassigned`.
6. Clicking a lower-box entry moves one trilobite from `unassigned` into the chosen assignment.
7. Transfers mutate the live trilobite objects immediately by changing `assignment`, clearing queued actions, and invoking the corresponding behavior.

### `Selected` tab flow
1. Appears only while a trilobite or building is currently selected.
2. Shows basic details for the current selection.
3. Provides a delete button labelled for the selected object type.
4. Clicking delete calls the selected object's normal `removeFromGame` path.
5. Once deletion clears the selection, the `Selected` tab disappears and the menu falls back to `Buildings`.

### Menu/Game state interaction
- `cleanActive()` is the central reset for active selection state:
1. Destroys floating path sprites and building edge highlights.
2. Clears any active BFS debug overlay labels.
3. Exits move/build modes.
4. Removes and destroys the floating building sprite.
5. Clears the selected object and selected-path overlays.
6. Preserves the shared menu panel by default so the player can keep browsing tabs after the selection clears.
- `Escape` is the explicit path that both clears active state and closes the shared menu panel; there is no dedicated hide button in the panel UI.
- Several workflows call `cleanActive()` to prevent mode overlap and stale UI.
