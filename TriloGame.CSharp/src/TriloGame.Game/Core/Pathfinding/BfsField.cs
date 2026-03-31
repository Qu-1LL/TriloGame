using TriloGame.Game.Core.Buildings;
using TriloGame.Game.Core.Entities;
using TriloGame.Game.Core.World;
using TriloGame.Game.Shared.Math;

namespace TriloGame.Game.Core.Pathfinding;

public sealed class BfsField
{
    public BfsField(string name = "", string type = "shared", Cave? cave = null, Building? ownerBuilding = null)
    {
        Name = name;
        Type = type;
        Cave = cave;
        OwnerBuilding = ownerBuilding;
        Field = new Dictionary<string, int>(StringComparer.Ordinal);
        UpdatedTiles = new HashSet<string>(StringComparer.Ordinal);
        UpdatedBuildings = [];
        UpdatedCreatures = [];
        TrackedBuildings = [];
        TrackedCreatures = [];
    }

    public string Name { get; }

    public string Type { get; }

    public Cave? Cave { get; private set; }

    public Building? OwnerBuilding { get; private set; }

    public Dictionary<string, int> Field { get; private set; }

    public bool Updated { get; private set; }

    public HashSet<string> UpdatedTiles { get; }

    public HashSet<Building> UpdatedBuildings { get; }

    public HashSet<Creature> UpdatedCreatures { get; }

    public HashSet<Building> TrackedBuildings { get; }

    public HashSet<Creature> TrackedCreatures { get; }

    public void SetCave(Cave? cave)
    {
        Cave = cave;
    }

    public void SetOwnerBuilding(Building? building)
    {
        OwnerBuilding = building;
    }

    public void SetField(Dictionary<string, int>? field)
    {
        Field = field is null
            ? new Dictionary<string, int>(StringComparer.Ordinal)
            : new Dictionary<string, int>(field, StringComparer.Ordinal);
    }

    public Dictionary<string, int> CommitField(Dictionary<string, int> field)
    {
        SetField(field);
        ClearUpdates();
        return Field;
    }

    public bool IsUpdated() => Updated;

    public void SetTrackedTargets(IEnumerable<Building>? buildings = null, IEnumerable<Creature>? creatures = null)
    {
        TrackedBuildings.Clear();
        TrackedCreatures.Clear();

        foreach (var building in buildings ?? [])
        {
            TrackedBuildings.Add(building);
        }

        foreach (var creature in creatures ?? [])
        {
            TrackedCreatures.Add(creature);
        }
    }

    public bool ClearUpdates()
    {
        Updated = true;
        UpdatedTiles.Clear();
        UpdatedBuildings.Clear();
        UpdatedCreatures.Clear();
        return Updated;
    }

    public bool MarkTilesDirty(IEnumerable<string>? tileKeys)
    {
        Updated = false;
        foreach (var tileKey in tileKeys ?? [])
        {
            if (!string.IsNullOrWhiteSpace(tileKey))
            {
                UpdatedTiles.Add(tileKey);
            }
        }

        return Updated;
    }

    public bool MarkBuildingsDirty(IEnumerable<Building>? buildings)
    {
        Updated = false;
        foreach (var building in buildings ?? [])
        {
            UpdatedBuildings.Add(building);
        }

        return Updated;
    }

    public bool MarkCreaturesDirty(IEnumerable<Creature>? creatures)
    {
        Updated = false;
        foreach (var creature in creatures ?? [])
        {
            UpdatedCreatures.Add(creature);
        }

        return Updated;
    }

    public bool MarkDirty(IEnumerable<string>? tileKeys, IEnumerable<Building>? buildings, IEnumerable<Creature>? creatures)
    {
        Updated = false;
        MarkTilesDirty(tileKeys);
        MarkBuildingsDirty(buildings);
        MarkCreaturesDirty(creatures);
        return Updated;
    }

    public Dictionary<string, int> GetField(bool refresh = true)
    {
        return refresh ? Refresh() : Field;
    }

    public bool HasActiveBuildingTarget()
    {
        return string.Equals(Type, "building", StringComparison.Ordinal) &&
               Cave is not null &&
               OwnerBuilding is not null &&
               OwnerBuilding.TileArray.Count > 0;
    }

    public Tile? GetTile(string? tileKey)
    {
        if (string.IsNullOrWhiteSpace(tileKey) || Cave is null)
        {
            return null;
        }

        return Cave.GetTile(tileKey);
    }

    private bool IsTileInCoverage(Tile? tile)
    {
        if (tile is null || Cave is null)
        {
            return false;
        }

        if (string.Equals(Type, "building", StringComparison.Ordinal))
        {
            return HasActiveBuildingTarget() && Cave.IsTileReachable(tile);
        }

        return Cave.IsTileRevealed(tile);
    }

    private IReadOnlyList<Tile> GetCoverageTiles()
    {
        if (Cave is null)
        {
            return [];
        }

        if (string.Equals(Type, "building", StringComparison.Ordinal))
        {
            return HasActiveBuildingTarget() ? Cave.GetReachableTiles() : [];
        }

        return Cave.GetTiles().Where(IsTileInCoverage).ToArray();
    }

    private Dictionary<string, int> CreateBaseField()
    {
        var field = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var tile in GetCoverageTiles())
        {
            field[tile.Key] = int.MaxValue;
        }

        return field;
    }

    private Dictionary<string, int> SyncCoverage(Dictionary<string, int> field)
    {
        foreach (var tileKey in field.Keys.ToArray())
        {
            if (!IsTileInCoverage(GetTile(tileKey)))
            {
                field.Remove(tileKey);
            }
        }

        foreach (var tile in GetCoverageTiles())
        {
            field.TryAdd(tile.Key, int.MaxValue);
        }

        return field;
    }

    private void AddAdjacentPassableSeeds(Tile? tile, HashSet<string> blockedKeys, HashSet<string> seedKeys)
    {
        if (tile is null)
        {
            return;
        }

        foreach (var neighbor in tile.Neighbors)
        {
            if (!IsTileInCoverage(neighbor) || !neighbor.CreatureFits() || blockedKeys.Contains(neighbor.Key))
            {
                continue;
            }

            seedKeys.Add(neighbor.Key);
        }
    }

    private void AddBuildingTargets(Building? building, HashSet<string> blockedKeys, HashSet<string> seedKeys, bool blockPassableTiles = false)
    {
        if (building is null || building.TileArray.Count == 0)
        {
            return;
        }

        foreach (var tile in building.TileArray)
        {
            var shouldBlockTile = blockPassableTiles || !tile.CreatureFits();
            if (!shouldBlockTile)
            {
                continue;
            }

            blockedKeys.Add(tile.Key);
            AddAdjacentPassableSeeds(tile, blockedKeys, seedKeys);
        }
    }

    private HashSet<string> BuildBuildingSeedKeys(Building? building)
    {
        var seedKeys = new HashSet<string>(StringComparer.Ordinal);
        if (building is null || building.TileArray.Count == 0)
        {
            return seedKeys;
        }

        foreach (var tile in building.TileArray)
        {
            if (tile.CreatureFits() && IsTileInCoverage(tile))
            {
                seedKeys.Add(tile.Key);
            }
        }

        if (seedKeys.Count > 0)
        {
            return seedKeys;
        }

        foreach (var tile in building.TileArray)
        {
            foreach (var neighbor in tile.Neighbors)
            {
                if (neighbor.CreatureFits() && IsTileInCoverage(neighbor))
                {
                    seedKeys.Add(neighbor.Key);
                }
            }
        }

        return seedKeys;
    }

    private (HashSet<string> BlockedKeys, HashSet<string> SeedKeys) BuildSnapshot()
    {
        var blockedKeys = new HashSet<string>(StringComparer.Ordinal);
        var seedKeys = new HashSet<string>(StringComparer.Ordinal);
        var trackedBuildings = new List<Building>();
        var trackedCreatures = new List<Creature>();

        if (Cave is null)
        {
            SetTrackedTargets();
            return (blockedKeys, seedKeys);
        }

        foreach (var tile in Cave.GetTiles())
        {
            if (!IsTileInCoverage(tile) || !tile.CreatureFits())
            {
                blockedKeys.Add(tile.Key);
            }
        }

        if (string.Equals(Type, "building", StringComparison.Ordinal))
        {
            if (HasActiveBuildingTarget())
            {
                trackedBuildings.Add(OwnerBuilding!);
                foreach (var seedKey in BuildBuildingSeedKeys(OwnerBuilding))
                {
                    seedKeys.Add(seedKey);
                }
            }
        }
        else if (string.Equals(Type, "enemy", StringComparison.Ordinal))
        {
            foreach (var creature in Cave.Enemies)
            {
                trackedCreatures.Add(creature);
                var tile = GetTile(creature.Location.ToString());
                if (tile is null)
                {
                    continue;
                }

                blockedKeys.Add(tile.Key);
                AddAdjacentPassableSeeds(tile, blockedKeys, seedKeys);
            }
        }
        else if (string.Equals(Type, "colony", StringComparison.Ordinal))
        {
            foreach (var creature in Cave.Trilobites)
            {
                trackedCreatures.Add(creature);
                var tile = GetTile(creature.Location.ToString());
                if (tile is null)
                {
                    continue;
                }

                blockedKeys.Add(tile.Key);
                AddAdjacentPassableSeeds(tile, blockedKeys, seedKeys);
            }

            foreach (var building in Cave.Buildings)
            {
                trackedBuildings.Add(building);
                var isAlgaeFarm = string.Equals(building.Name, "Algae Farm", StringComparison.Ordinal) ||
                                  string.Equals(building.GetType().Name, "AlgaeFarm", StringComparison.Ordinal);
                AddBuildingTargets(building, blockedKeys, seedKeys, isAlgaeFarm);
            }
        }

        SetTrackedTargets(trackedBuildings, trackedCreatures);
        return (blockedKeys, seedKeys);
    }

    private int ComputeValue(string tileKey, Dictionary<string, int> field, (HashSet<string> BlockedKeys, HashSet<string> SeedKeys) snapshot)
    {
        var tile = GetTile(tileKey);
        if (tile is null || !IsTileInCoverage(tile) || snapshot.BlockedKeys.Contains(tileKey))
        {
            return int.MaxValue;
        }

        if (snapshot.SeedKeys.Contains(tileKey))
        {
            return 0;
        }

        var bestNeighbor = int.MaxValue;
        foreach (var neighbor in tile.Neighbors)
        {
            if (!IsTileInCoverage(neighbor) || snapshot.BlockedKeys.Contains(neighbor.Key))
            {
                continue;
            }

            var neighborValue = field.GetValueOrDefault(neighbor.Key, int.MaxValue);
            if (neighborValue < bestNeighbor)
            {
                bestNeighbor = neighborValue;
            }
        }

        return bestNeighbor == int.MaxValue ? int.MaxValue : bestNeighbor + 1;
    }

    public Dictionary<string, int> Rebuild()
    {
        var snapshot = BuildSnapshot();
        var field = CreateBaseField();
        var queue = new Queue<string>();

        foreach (var seedKey in snapshot.SeedKeys)
        {
            if (snapshot.BlockedKeys.Contains(seedKey) || !field.ContainsKey(seedKey))
            {
                continue;
            }

            field[seedKey] = 0;
            queue.Enqueue(seedKey);
        }

        while (queue.Count > 0)
        {
            var currentKey = queue.Dequeue();
            var currentTile = GetTile(currentKey);
            if (currentTile is null)
            {
                continue;
            }

            var currentValue = field.GetValueOrDefault(currentKey, int.MaxValue);
            if (currentValue == int.MaxValue)
            {
                continue;
            }

            foreach (var neighbor in currentTile.Neighbors)
            {
                if (!IsTileInCoverage(neighbor) || snapshot.BlockedKeys.Contains(neighbor.Key))
                {
                    continue;
                }

                var nextValue = currentValue + 1;
                if (nextValue >= field.GetValueOrDefault(neighbor.Key, int.MaxValue))
                {
                    continue;
                }

                field[neighbor.Key] = nextValue;
                queue.Enqueue(neighbor.Key);
            }
        }

        return CommitField(field);
    }

    public Dictionary<string, int> Rebalance(IEnumerable<string>? dirtyKeys = null)
    {
        var dirty = dirtyKeys?.ToArray() ?? UpdatedTiles.ToArray();
        if (Field.Count == 0 || dirty.Length == 0)
        {
            return Rebuild();
        }

        var field = SyncCoverage(new Dictionary<string, int>(Field, StringComparer.Ordinal));
        var snapshot = BuildSnapshot();
        var queue = new Queue<string>();
        var queued = new HashSet<string>(StringComparer.Ordinal);

        void Enqueue(string tileKey)
        {
            if (string.IsNullOrWhiteSpace(tileKey) || queued.Contains(tileKey))
            {
                return;
            }

            var tile = GetTile(tileKey);
            if (tile is null || !IsTileInCoverage(tile))
            {
                return;
            }

            queued.Add(tileKey);
            queue.Enqueue(tileKey);
        }

        foreach (var dirtyKey in dirty)
        {
            var tile = GetTile(dirtyKey);
            if (tile is null)
            {
                continue;
            }

            Enqueue(tile.Key);
            foreach (var neighbor in tile.Neighbors)
            {
                Enqueue(neighbor.Key);
            }
        }

        while (queue.Count > 0)
        {
            var currentKey = queue.Dequeue();
            queued.Remove(currentKey);

            var currentValue = field.GetValueOrDefault(currentKey, int.MaxValue);
            var nextValue = ComputeValue(currentKey, field, snapshot);
            if (currentValue == nextValue)
            {
                continue;
            }

            field[currentKey] = nextValue;
            var currentTile = GetTile(currentKey);
            if (currentTile is null)
            {
                continue;
            }

            foreach (var neighbor in currentTile.Neighbors)
            {
                Enqueue(neighbor.Key);
            }
        }

        return CommitField(field);
    }

    public Dictionary<string, int> Refresh()
    {
        if (Field.Count == 0)
        {
            return Rebuild();
        }

        if (IsUpdated())
        {
            return Field;
        }

        return UpdatedTiles.Count == 0 ? Rebuild() : Rebalance();
    }

    public int GetFieldValue(GridPoint location, bool refresh = true)
    {
        var field = GetField(refresh);
        return field.GetValueOrDefault(location.ToString(), int.MaxValue);
    }

    public GridPoint? GetNextStep(GridPoint location, bool refresh = true)
    {
        var field = GetField(refresh);
        var currentTile = GetTile(location.ToString());
        if (currentTile is null)
        {
            return null;
        }

        var currentValue = field.GetValueOrDefault(location.ToString(), int.MaxValue);
        Tile? bestNeighbor = null;
        var bestValue = currentValue;

        foreach (var neighbor in currentTile.Neighbors)
        {
            if (!neighbor.CreatureFits())
            {
                continue;
            }

            var neighborValue = field.GetValueOrDefault(neighbor.Key, int.MaxValue);
            if (neighborValue == int.MaxValue || neighborValue >= bestValue)
            {
                continue;
            }

            if (bestNeighbor is null || neighborValue < bestValue || string.CompareOrdinal(neighbor.Key, bestNeighbor.Key) < 0)
            {
                bestNeighbor = neighbor;
                bestValue = neighborValue;
            }
        }

        return bestNeighbor is null ? null : GridPoint.Parse(bestNeighbor.Key);
    }

    public List<GridPoint>? BuildPathFrom(GridPoint startLocation, bool refresh = true)
    {
        var field = GetField(refresh);
        var startValue = field.GetValueOrDefault(startLocation.ToString(), int.MaxValue);
        if (startValue == int.MaxValue)
        {
            return null;
        }

        var path = new List<GridPoint> { startLocation };
        var current = startLocation;
        var currentValue = startValue;
        var timeCount = 0;

        while (currentValue > 0 && timeCount < 7850)
        {
            var next = GetNextStep(current, false);
            if (next is null)
            {
                return null;
            }

            path.Add(next.Value);
            current = next.Value;
            currentValue = field.GetValueOrDefault(current.ToString(), int.MaxValue);
            timeCount++;
        }

        return currentValue == 0 ? path : null;
    }
}
