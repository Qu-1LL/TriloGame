using TriloGame.Game.Core.Buildings;
using TriloGame.Game.Core.Simulation;
using TriloGame.Game.Shared.Math;

namespace TriloGame.Game.Core.Entities;

public sealed partial class Trilobite : Creature
{
    public Trilobite(string name, GridPoint location, GameSession session)
        : base(name, location, session)
    {
        Inventory = new Core.Economy.Inventory();
        InventoryCapacity = 5;
        BuilderWorkRate = 5;
    }

    public Core.Economy.Inventory Inventory { get; }

    public int InventoryCapacity { get; }

    public Building? AssignedBuilding { get; private set; }

    public string? PendingMineTileKey { get; private set; }

    public string? FighterTargetTileKey { get; private set; }

    public string? FighterPathMode { get; private set; }

    public MiningPost? BuilderSourcePost { get; private set; }

    public int BuilderWorkRate { get; }

    public bool HasInventory() => Inventory.HasItems;

    public int GetInventorySpace() => System.Math.Max(0, InventoryCapacity - Inventory.Amount);

    public int AddToInventory(string resourceType, int amount) => Inventory.Add(resourceType, amount, InventoryCapacity);

    public int RemoveFromInventory(int amount) => Inventory.Remove(amount);

    public void ClearInventory() => Inventory.Clear();

    public override void CleanupBeforeRemoval(object? source = null)
    {
        ClearActionQueue();
        ClearFighterTarget();
        FighterPathMode = null;
        ReleaseAssignedBuilding();
        ClearInventory();
    }

    public override Action? GetBehavior()
    {
        return Assignment switch
        {
            "miner" => MinerBehavior,
            "farmer" => FarmerBehavior,
            "builder" => BuilderBehavior,
            "fighter" => FighterBehavior,
            _ => UnassignedBehavior
        };
    }

    private void UnassignedBehavior()
    {
        ClearFighterTarget();
        FighterPathMode = null;
        ReleaseAssignedBuilding();
    }

    private void MinerBehavior() => EnqueueAction(() => { MinerStep1(); });

    private void FarmerBehavior() => EnqueueAction(() => { FarmerStep1(); });

    private void BuilderBehavior() => EnqueueAction(() => { BuilderStep1(); });

    private void FighterBehavior() => EnqueueAction(() => { FighterStep1(); });

    public bool IsMiner() => Assignment == "miner";

    public bool IsFarmer() => Assignment == "farmer";

    public bool IsBuilder() => Assignment == "builder";

    public bool IsFighter() => Assignment == "fighter";

    public bool EnsureMinerState()
    {
        ClearFighterTarget();
        FighterPathMode = null;

        if (IsMiner())
        {
            if (GetAssignedBuilding() is not null && GetAssignedMiningPost() is null)
            {
                ReleaseAssignedBuilding();
            }

            return true;
        }

        if (GetAssignedMiningPost() is not null)
        {
            ReleaseAssignedBuilding();
        }

        var fallback = GetBehavior();
        if (fallback is not null && !ReferenceEquals(fallback, (Action)MinerBehavior))
        {
            fallback();
        }

        return false;
    }

    public bool EnsureFarmerState()
    {
        ClearFighterTarget();
        FighterPathMode = null;

        if (IsFarmer())
        {
            if (GetAssignedBuilding() is not null && GetAssignedAlgaeFarm() is null)
            {
                ReleaseAssignedBuilding();
            }

            return true;
        }

        if (GetAssignedAlgaeFarm() is not null)
        {
            ReleaseAssignedBuilding();
        }

        var fallback = GetBehavior();
        if (fallback is not null && !ReferenceEquals(fallback, (Action)FarmerBehavior))
        {
            fallback();
        }

        return false;
    }

    public bool EnsureBuilderState()
    {
        ClearFighterTarget();
        FighterPathMode = null;

        if (IsBuilder())
        {
            if (GetAssignedBuilding() is not null && GetAssignedScaffolding() is null)
            {
                ReleaseAssignedBuilding();
            }

            return true;
        }

        if (GetAssignedScaffolding() is not null)
        {
            ReleaseAssignedBuilding();
        }
        else
        {
            ClearBuilderSourcePost();
        }

        var fallback = GetBehavior();
        if (fallback is not null && !ReferenceEquals(fallback, (Action)BuilderBehavior))
        {
            fallback();
        }

        return false;
    }

    public bool EnsureFighterState()
    {
        if (IsFighter())
        {
            if (GetAssignedBuilding() is not null && GetAssignedBarracks() is null)
            {
                ReleaseAssignedBuilding();
            }

            return true;
        }

        ClearFighterTarget();
        FighterPathMode = null;
        if (GetAssignedBarracks() is not null)
        {
            ReleaseAssignedBuilding();
        }

        var fallback = GetBehavior();
        if (fallback is not null && !ReferenceEquals(fallback, (Action)FighterBehavior))
        {
            fallback();
        }

        return false;
    }

    public List<AlgaeFarm> GetAlgaeFarms()
    {
        return Cave is null ? [] : Cave.Buildings.OfType<AlgaeFarm>().ToList();
    }

    public Queen? GetQueen()
    {
        return Cave?.Buildings.OfType<Queen>().FirstOrDefault();
    }

    public GridPoint? GetClosestPassableBuildingTile(Building building, GridPoint? startLocation = null)
    {
        var origin = startLocation ?? Location;
        GridPoint? bestTile = null;
        var bestDistance = int.MaxValue;

        foreach (var tile in building.TileArray)
        {
            if (!tile.CreatureFits())
            {
                continue;
            }

            var tileCoords = GridPoint.Parse(tile.Key);
            var distance = GridPoint.SquaredDistance(origin, tileCoords);
            if (distance < bestDistance)
            {
                bestDistance = distance;
                bestTile = tileCoords;
            }
        }

        return bestTile;
    }

    public bool IsOnPassableBuildingTile(Building building, GridPoint? location = null)
    {
        return building.TileArray.Any(tile => tile.Key == (location ?? Location).ToString() && tile.CreatureFits());
    }

    public int FeedQueenAlgae(Queen queen)
    {
        if (!HasInventory() || Inventory.Type != "Algae")
        {
            return 0;
        }

        var result = queen.FeedAlgae(Inventory.Amount, this, Cave);
        if (result.Accepted <= 0)
        {
            return 0;
        }

        RemoveFromInventory(result.Accepted);
        return result.Accepted;
    }

    public Building? GetAssignedBuilding() => AssignedBuilding;

    public AlgaeFarm? GetAssignedAlgaeFarm() => AssignedBuilding as AlgaeFarm;

    public MiningPost? GetAssignedMiningPost() => AssignedBuilding as MiningPost;

    public Barracks? GetAssignedBarracks() => AssignedBuilding as Barracks;

    public Scaffolding? GetAssignedScaffolding() => AssignedBuilding as Scaffolding;

    public void SetAssignedBuilding(Building? building)
    {
        if (!ReferenceEquals(AssignedBuilding, building))
        {
            ReleaseAssignedBuilding();
            AssignedBuilding = building;
        }
    }

    public void ReleaseAssignedBuilding()
    {
        ClearBuilderSourcePost();
        if (AssignedBuilding is null)
        {
            PendingMineTileKey = null;
            return;
        }

        switch (AssignedBuilding)
        {
            case MiningPost post:
                if (PendingMineTileKey is not null)
                {
                    post.InvalidateMineableQueues();
                }
                post.RemoveAssignment(this);
                break;
            case AlgaeFarm farm:
                farm.RemoveAssignment(this);
                break;
            case Barracks barracks:
                barracks.RemoveAssignment(this);
                break;
            case Scaffolding scaffolding:
                scaffolding.RemoveAssignment(this);
                scaffolding.ReleaseMaterialReservation(this);
                break;
        }

        PendingMineTileKey = null;
        AssignedBuilding = null;
    }

    public void ClearBuilderSourcePost(bool releaseReservation = true)
    {
        if (releaseReservation && BuilderSourcePost is not null)
        {
            BuilderSourcePost.ReleaseMaterialReservation(this);
        }

        BuilderSourcePost = null;
    }

    public void ClearFighterTarget()
    {
        FighterTargetTileKey = null;
    }

    public List<Barracks> GetBarracksBuildings()
    {
        return Cave is null ? [] : Cave.Buildings.OfType<Barracks>().ToList();
    }

    public Barracks? GetBarracksAtLocation(GridPoint? location = null)
    {
        var checkLocation = location ?? Location;
        return GetBarracksBuildings().FirstOrDefault(barracks => IsOnPassableBuildingTile(barracks, checkLocation));
    }

    public List<Barracks> GetBarracksPriorityList()
    {
        return GetBarracksBuildings()
            .Where(barracks => GetClosestPassableBuildingTile(barracks) is not null)
            .OrderBy(barracks => barracks.GetVolume())
            .ThenBy(barracks => GridPoint.SquaredDistance(Location, GetClosestPassableBuildingTile(barracks) ?? Location))
            .ToList();
    }

    public List<Enemy> GetEnemyCreatures()
    {
        return Cave is null ? [] : Cave.Enemies.ToList();
    }

    public Enemy? GetEnemyAtTileKey(string? tileKey)
    {
        return string.IsNullOrWhiteSpace(tileKey)
            ? null
            : GetEnemyCreatures().FirstOrDefault(enemy => enemy.Location.ToString() == tileKey);
    }

    public bool IsAdjacentToTileKey(string tileKey, GridPoint? location = null)
    {
        return GridPoint.ManhattanDistance(location ?? Location, GridPoint.Parse(tileKey)) == 1;
    }

    public string? GetAdjacentEnemyTileKey(GridPoint? location = null)
    {
        var currentTile = Cave?.GetTile((location ?? Location).ToString());
        if (currentTile is null)
        {
            return null;
        }

        return currentTile.Neighbors
            .Select(neighbor => GetEnemyAtTileKey(neighbor.Key) is not null ? neighbor.Key : null)
            .FirstOrDefault(key => key is not null);
    }

    public bool QueueFighterPath(IReadOnlyList<GridPoint> path, string? mode = null, bool clearExisting = true)
    {
        if (clearExisting)
        {
            ClearActionQueue();
        }

        if (path.Count < 2)
        {
            FighterPathMode = null;
            return path.Count > 0;
        }

        FighterPathMode = mode;
        foreach (var step in path.Skip(1))
        {
            PathPreview.Add(step);
            EnqueueAction(() => { FighterStepMove(step); });
        }

        return true;
    }

    public bool TryNavigateBarracks(IReadOnlyList<Barracks> orderedBarracks, int index = 0)
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        if (index >= orderedBarracks.Count)
        {
            return false;
        }

        var barracks = orderedBarracks[index];
        SetAssignedBuilding(barracks);
        barracks.Assign(this);

        if (IsOnPassableBuildingTile(barracks))
        {
            return false;
        }

        var path = BuildNavigationPathToBuilding(barracks);
        if (path is null)
        {
            ReleaseAssignedBuilding();
            return TryNavigateBarracks(orderedBarracks, index + 1);
        }

        return QueueFighterPath(path, "barracks");
    }

    public bool FighterReturnToBarracks(bool preferAssignedBarracks = true)
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        var assignedBarracks = GetAssignedBarracks();
        if (preferAssignedBarracks && assignedBarracks is not null)
        {
            assignedBarracks.Assign(this);
            if (IsOnPassableBuildingTile(assignedBarracks))
            {
                return false;
            }

            var orderedBarracks = new List<Barracks> { assignedBarracks };
            orderedBarracks.AddRange(GetBarracksPriorityList().Where(barracks => !ReferenceEquals(barracks, assignedBarracks)));
            return TryNavigateBarracks(orderedBarracks);
        }

        if (preferAssignedBarracks)
        {
            var currentBarracks = GetBarracksAtLocation();
            if (currentBarracks is not null)
            {
                SetAssignedBuilding(currentBarracks);
                currentBarracks.Assign(this);
                return false;
            }
        }

        var ordered = GetBarracksPriorityList();
        if (ordered.Count == 0)
        {
            if (!preferAssignedBarracks)
            {
                ReleaseAssignedBuilding();
            }

            return false;
        }

        return TryNavigateBarracks(ordered);
    }

    public bool FighterStep1()
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        FighterPathMode = null;

        if (!Session.Danger)
        {
            ClearFighterTarget();
            return FighterReturnToBarracks(true);
        }

        if (FighterTargetTileKey is not null && IsAdjacentToTileKey(FighterTargetTileKey))
        {
            return FighterStep2();
        }

        var adjacentEnemyTileKey = GetAdjacentEnemyTileKey();
        if (adjacentEnemyTileKey is not null)
        {
            FighterTargetTileKey = adjacentEnemyTileKey;
            return FighterStep2();
        }

        return FighterStep3();
    }

    public bool FighterStep2()
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        if (!Session.Danger)
        {
            ClearFighterTarget();
            return FighterReturnToBarracks(true);
        }

        if (FighterTargetTileKey is null)
        {
            return FighterStep3();
        }

        var enemy = GetEnemyAtTileKey(FighterTargetTileKey);
        if (enemy is null)
        {
            ClearFighterTarget();
            return FighterStep3();
        }

        if (!IsAdjacentToTileKey(FighterTargetTileKey))
        {
            return FighterStep3();
        }

        var dealt = DealDamage(enemy);
        if (GetEnemyAtTileKey(FighterTargetTileKey) is null)
        {
            ClearFighterTarget();
        }

        return dealt > 0;
    }

    public bool FighterStep3()
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        if (!Session.Danger)
        {
            ClearFighterTarget();
            return FighterReturnToBarracks(true);
        }

        if (FighterTargetTileKey is not null && GetEnemyAtTileKey(FighterTargetTileKey) is null)
        {
            ClearFighterTarget();
        }

        var nextLocation = Cave?.GetBfsFieldNextStep("enemy", Location);
        if (nextLocation is null)
        {
            ClearFighterTarget();
            return FighterReturnToBarracks(false);
        }

        ClearActionQueue();
        PathPreview.Add(nextLocation.Value);
        return FighterStepMove(nextLocation.Value);
    }

    public bool FighterStepMove(GridPoint nextLocation)
    {
        if (!EnsureFighterState())
        {
            return false;
        }

        if (!Session.Danger)
        {
            if (FighterPathMode != "barracks")
            {
                ClearActionQueue();
                return FighterStep1();
            }

            var assignedBarracks = GetAssignedBarracks();
            if (assignedBarracks is not null && IsOnPassableBuildingTile(assignedBarracks))
            {
                FighterPathMode = null;
                ClearActionQueue();
                return false;
            }
        }
        else if (FighterPathMode == "barracks")
        {
            FighterPathMode = null;
            ClearActionQueue();
            return FighterStep1();
        }

        if (FighterPathMode != "barracks")
        {
            if (FighterTargetTileKey is not null && GetEnemyAtTileKey(FighterTargetTileKey) is null)
            {
                ClearFighterTarget();
                ClearActionQueue();
                return FighterStep3();
            }

            var adjacentEnemyTileKey = GetAdjacentEnemyTileKey();
            if (adjacentEnemyTileKey is not null)
            {
                FighterTargetTileKey = adjacentEnemyTileKey;
                ClearActionQueue();
                return FighterStep2();
            }
        }

        var wasBarracksMove = FighterPathMode == "barracks";
        var moved = PerformMove(nextLocation);
        if (!moved)
        {
            if (wasBarracksMove)
            {
                FighterPathMode = null;
            }

            ClearActionQueue();
            return wasBarracksMove ? FighterReturnToBarracks(true) : FighterStep3();
        }

        if (PathPreview.Count > 0)
        {
            PathPreview.RemoveAt(0);
        }

        if (wasBarracksMove)
        {
            var assignedBarracks = GetAssignedBarracks();
            if (assignedBarracks is not null && IsOnPassableBuildingTile(assignedBarracks))
            {
                FighterPathMode = null;
                ClearActionQueue();
                return false;
            }

            return true;
        }

        if (FighterTargetTileKey is not null && IsAdjacentToTileKey(FighterTargetTileKey))
        {
            ClearActionQueue();
            return FighterStep2();
        }

        var nextAdjacentEnemyTileKey = GetAdjacentEnemyTileKey();
        if (nextAdjacentEnemyTileKey is not null)
        {
            FighterTargetTileKey = nextAdjacentEnemyTileKey;
            ClearActionQueue();
            return FighterStep2();
        }

        return true;
    }

    public List<AlgaeFarm> GetAlgaeFarmPriorityList()
    {
        return GetAlgaeFarms()
            .Where(farm => farm.GetApproachTile(Location) is not null)
            .OrderBy(farm => farm.GetVolume())
            .ThenBy(farm => GridPoint.SquaredDistance(Location, farm.GetApproachTile(Location) ?? Location))
            .ToList();
    }

    public bool TryNavigateAlgaeFarms(IReadOnlyList<AlgaeFarm> orderedFarms, int index = 0)
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        if (index >= orderedFarms.Count)
        {
            ReleaseAssignedBuilding();
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        var farm = orderedFarms[index];
        SetAssignedBuilding(farm);
        farm.Assign(this);

        if (farm.IsLocationOnFarm(Location))
        {
            return FarmerStep2();
        }

        var navFallback = new Action(() =>
        {
            ReleaseAssignedBuilding();
            TryNavigateAlgaeFarms(orderedFarms, index + 1);
        });

        if (!NavigateToBuilding(farm, navFallback))
        {
            ReleaseAssignedBuilding();
            return TryNavigateAlgaeFarms(orderedFarms, index + 1);
        }

        EnqueueAction(() => { FarmerStep2(); });
        return true;
    }

    public bool FarmerStep1()
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        if (HasInventory())
        {
            if (Inventory.Type == "Algae")
            {
                return FarmerStep4();
            }

            ClearInventory();
        }

        var orderedFarms = GetAlgaeFarmPriorityList();
        if (orderedFarms.Count == 0)
        {
            ReleaseAssignedBuilding();
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        return TryNavigateAlgaeFarms(orderedFarms);
    }

    public bool FarmerStep2()
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        var farm = GetAssignedAlgaeFarm();
        if (farm is null)
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        if (!farm.IsLocationOnFarm(Location))
        {
            var navFallback = new Action(() =>
            {
                ReleaseAssignedBuilding();
                FarmerStep1();
            });

            if (!NavigateToBuilding(farm, navFallback))
            {
                return false;
            }

            EnqueueAction(() => { FarmerStep2(); });
            return true;
        }

        var farmPath = farm.GetPath(Location);
        if (farmPath.Count < 2)
        {
            if (farm.TryHarvest(this))
            {
                return FarmerStep4();
            }

            EnqueueAction(() => { FarmerStep2(); });
            return false;
        }

        for (var index = 1; index < farmPath.Count; index++)
        {
            var next = farmPath[index];
            var isLastStep = index == farmPath.Count - 1;
            EnqueueAction(() => { FarmerStep3(next, isLastStep); });
        }

        return true;
    }

    public bool FarmerStep3(GridPoint nextLocation, bool isLastStep = false)
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        var farm = GetAssignedAlgaeFarm();
        if (farm is null)
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        var moved = PerformMove(nextLocation);
        if (!moved)
        {
            ClearActionQueue();
            EnqueueAction(() => { FarmerStep2(); });
            return false;
        }

        if (!farm.TryHarvest(this))
        {
            return isLastStep ? FarmerStep2() : true;
        }

        ClearActionQueue();
        return FarmerStep4();
    }

    public bool FarmerStep4()
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        if (!HasInventory() || Inventory.Type != "Algae")
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        var queen = GetQueen();
        if (queen is null)
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        if (IsOnPassableBuildingTile(queen))
        {
            return FarmerStep5();
        }

        var nextLocation = Cave?.GetBuildingBfsFieldNextStep(queen, Location);
        if (nextLocation is null)
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        ClearActionQueue();
        PathPreview.Add(nextLocation.Value);
        return FarmerStepMoveToQueen(nextLocation.Value);
    }

    public bool FarmerStepMoveToQueen(GridPoint nextLocation)
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        var moved = PerformMove(nextLocation);
        if (!moved)
        {
            ClearActionQueue();
            return FarmerStep4();
        }

        if (PathPreview.Count > 0)
        {
            PathPreview.RemoveAt(0);
        }

        return true;
    }

    public bool FarmerStep5()
    {
        if (!EnsureFarmerState())
        {
            return false;
        }

        var queen = GetQueen();
        if (queen is null)
        {
            EnqueueAction(() => { FarmerStep1(); });
            return false;
        }

        if (!IsOnPassableBuildingTile(queen))
        {
            return FarmerStep4();
        }

        var fed = FeedQueenAlgae(queen);
        if (fed <= 0)
        {
            EnqueueAction(() => { FarmerStep4(); });
            return false;
        }

        return FarmerStep1();
    }

    public List<MiningPost> GetMiningPosts()
    {
        return Cave is null ? [] : Cave.Buildings.OfType<MiningPost>().ToList();
    }

    public void ResetPendingMineTarget(bool requeue = false)
    {
        var miningPost = GetAssignedMiningPost();
        if (requeue && miningPost is not null && PendingMineTileKey is not null)
        {
            miningPost.InvalidateMineableQueues();
        }

        miningPost?.Assign(this, null);
        PendingMineTileKey = null;
    }

    public List<MiningPost> GetMiningPostPriorityList()
    {
        return GetMiningPosts()
            .Where(post => post.GetInventorySpace() > 0 && post.HasQueuedMineableTiles(Cave!))
            .OrderBy(post => post.GetVolume())
            .ThenBy(post => GridPoint.SquaredDistance(Location, post.GetApproachTile(Cave!, Location) ?? Location))
            .ToList();
    }

    public bool TryNavigateMiningPosts(IReadOnlyList<MiningPost> orderedPosts, int index = 0)
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        if (index >= orderedPosts.Count)
        {
            ReleaseAssignedBuilding();
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var post = orderedPosts[index];
        SetAssignedBuilding(post);
        post.Assign(this, null);

        if (post.IsLocationInArea(Location))
        {
            return MinerStep2();
        }

        var navFallback = new Action(() =>
        {
            ReleaseAssignedBuilding();
            TryNavigateMiningPosts(orderedPosts, index + 1);
        });

        if (!NavigateToBuilding(post, navFallback))
        {
            ReleaseAssignedBuilding();
            return TryNavigateMiningPosts(orderedPosts, index + 1);
        }

        EnqueueAction(() => { MinerStep2(); });
        return true;
    }

    public bool MinerStep1()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        var orderedPosts = GetMiningPostPriorityList();
        if (orderedPosts.Count == 0)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        return TryNavigateMiningPosts(orderedPosts);
    }

    public bool MinerStep2()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        var miningPost = GetAssignedMiningPost();
        if (miningPost is null)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        if (HasInventory())
        {
            if (!miningPost.IsLocationOnPost(Location))
            {
                var navFallback = new Action(() =>
                {
                    ReleaseAssignedBuilding();
                    MinerStep1();
                });

                if (!NavigateToBuilding(miningPost, navFallback))
                {
                    return false;
                }

                EnqueueAction(() => { MinerStep2(); });
                return true;
            }

            var accepted = miningPost.Deposit(Inventory.Type!, Inventory.Amount);
            RemoveFromInventory(accepted);
            if (HasInventory())
            {
                EnqueueAction(() => { MinerStep1(); });
                return false;
            }
        }

        return MinerStep3();
    }

    public bool MinerStep3()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        var miningPost = GetAssignedMiningPost();
        if (miningPost is null)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var targetTile = miningPost.GrabMineableTile(Cave!, this);
        if (targetTile is null)
        {
            miningPost.Assign(this, null);
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        PendingMineTileKey = targetTile.Key;
        return MinerStep4();
    }

    public bool MinerStep4()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        var miningPost = GetAssignedMiningPost();
        if (miningPost is null || PendingMineTileKey is null)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        if (miningPost.GetAssignment(this) != PendingMineTileKey)
        {
            ResetPendingMineTarget(true);
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        return MinerStep5();
    }

    public bool MinerStep5()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        var miningPost = GetAssignedMiningPost();
        if (miningPost is null || PendingMineTileKey is null)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var targetTile = Cave?.GetTile(PendingMineTileKey);
        if (targetTile is null)
        {
            ResetPendingMineTarget(true);
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var navTarget = miningPost.GetNavigationTarget(Cave!, targetTile);
        if (navTarget is null)
        {
            ResetPendingMineTarget(true);
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var navFallback = new Action(() =>
        {
            ResetPendingMineTarget(true);
            MinerStep1();
        });

        if (!NavigateTo(navTarget.Value, navFallback))
        {
            return false;
        }

        if (Location == navTarget.Value)
        {
            return MinerStep6();
        }

        EnqueueAction(() => { MinerStep6(); });
        return true;
    }

    public bool MineTile(string tileKey)
    {
        var tile = Cave?.GetTile(tileKey);
        if (tile is null)
        {
            return false;
        }

        var mineYield = InventoryCapacity;
        if (GetInventorySpace() < mineYield || !Building.IsMineableType(tile.Base))
        {
            return false;
        }

        var tileCoords = GridPoint.Parse(tileKey);
        if (tile.Base == "wall")
        {
            if (GridPoint.ManhattanDistance(Location, tileCoords) != 1 || AddToInventory("Sandstone", mineYield) != mineYield)
            {
                return false;
            }

            if (!Session.MineTile(Cave!, tileKey, "creature"))
            {
                RemoveFromInventory(mineYield);
                return false;
            }

            return true;
        }

        if (Location != tileCoords || AddToInventory(tile.Base, mineYield) != mineYield)
        {
            return false;
        }

        if (!Session.MineTile(Cave!, tileKey, "creature"))
        {
            RemoveFromInventory(mineYield);
            return false;
        }

        return true;
    }

    public bool MinerStep6()
    {
        if (!EnsureMinerState())
        {
            return false;
        }

        if (GetAssignedMiningPost() is null || PendingMineTileKey is null)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        var success = MineTile(PendingMineTileKey);
        ResetPendingMineTarget(!success);
        if (!success)
        {
            EnqueueAction(() => { MinerStep1(); });
            return false;
        }

        return MinerStep1();
    }

    public List<Scaffolding> GetScaffoldingBuildings()
    {
        return Cave is null ? [] : Cave.Buildings.OfType<Scaffolding>().Where(scaffold => scaffold.IsInProgress()).ToList();
    }

    public (MiningPost Post, string ResourceType, int Amount)? GetBuilderSupplyOptionForScaffold(Scaffolding scaffold, IReadOnlyList<MiningPost>? orderedPosts = null)
    {
        orderedPosts ??= GetBuilderMiningPostPriorityList();
        var neededResources = scaffold.GetNeededResourceTypes(true, this);
        if (neededResources.Count == 0)
        {
            return null;
        }

        foreach (var post in orderedPosts)
        {
            foreach (var resourceType in neededResources)
            {
                var missingAmount = scaffold.GetUnreservedRemainingRequirement(resourceType, this);
                var availableAmount = post.GetAvailableInventory(resourceType, this);
                var reserveAmount = System.Math.Min(InventoryCapacity, System.Math.Min(missingAmount, availableAmount));
                if (reserveAmount > 0)
                {
                    return (post, resourceType, reserveAmount);
                }
            }
        }

        return null;
    }

    public bool CanActOnScaffold(Scaffolding scaffold)
    {
        if (!scaffold.IsInProgress())
        {
            return false;
        }

        if (HasInventory())
        {
            return scaffold.NeedsResource(Inventory.Type!);
        }

        if (scaffold.GetMaterialReservation(this) is not null || BuilderSourcePost?.GetMaterialReservation(this) is not null)
        {
            return true;
        }

        if (!scaffold.IsRecipeComplete())
        {
            return GetBuilderSupplyOptionForScaffold(scaffold) is not null;
        }

        if (scaffold.NeedsConstructionWork())
        {
            return true;
        }

        return scaffold.IsConstructionComplete();
    }

    public List<Scaffolding> GetScaffoldingPriorityList(bool actionableOnly = false, IEnumerable<Scaffolding>? excludeScaffolds = null)
    {
        var excluded = excludeScaffolds?.ToHashSet() ?? [];
        return GetScaffoldingBuildings()
            .Where(scaffold =>
                !excluded.Contains(scaffold) &&
                (Cave?.GetBuildingBfsFieldValue(scaffold, Location) ?? int.MaxValue) != int.MaxValue &&
                (!actionableOnly || CanActOnScaffold(scaffold)))
            .OrderBy(scaffold => scaffold.GetVolume())
            .ThenBy(scaffold => Cave?.GetBuildingBfsFieldValue(scaffold, Location) ?? int.MaxValue)
            .ThenBy(scaffold => scaffold.Location is null ? int.MaxValue : GridPoint.SquaredDistance(Location, scaffold.Location.Value))
            .ToList();
    }

    public List<MiningPost> GetBuilderMiningPostPriorityList()
    {
        return GetMiningPosts()
            .Where(post => (Cave?.GetBuildingBfsFieldValue(post, Location) ?? int.MaxValue) != int.MaxValue)
            .OrderBy(post => Cave?.GetBuildingBfsFieldValue(post, Location) ?? int.MaxValue)
            .ThenBy(post => post.Location is null ? int.MaxValue : GridPoint.SquaredDistance(Location, post.Location.Value))
            .ToList();
    }

    public bool IsInBuildingWorkRange(Building building, GridPoint? location = null)
    {
        return (Cave?.GetBuildingBfsFieldValue(building, location ?? Location) ?? int.MaxValue) == 0;
    }

    public Scaffolding? EnsureBuilderAssignment(bool actionableOnly = false, IEnumerable<Scaffolding>? excludeScaffolds = null)
    {
        var excluded = excludeScaffolds?.ToHashSet() ?? [];
        var assignedScaffold = GetAssignedScaffolding();
        if (assignedScaffold is not null &&
            assignedScaffold.IsInProgress() &&
            !excluded.Contains(assignedScaffold) &&
            (!actionableOnly || CanActOnScaffold(assignedScaffold)))
        {
            assignedScaffold.Assign(this);
            return assignedScaffold;
        }

        if (assignedScaffold is not null)
        {
            ReleaseAssignedBuilding();
        }

        var scaffold = GetScaffoldingPriorityList(actionableOnly, excluded).FirstOrDefault();
        if (scaffold is null)
        {
            ReleaseAssignedBuilding();
            return null;
        }

        SetAssignedBuilding(scaffold);
        scaffold.Assign(this);
        return scaffold;
    }

    public bool BuilderDepositInventoryToNearestMiningPost()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        if (!HasInventory())
        {
            return BuilderStep1();
        }

        var orderedPosts = GetBuilderMiningPostPriorityList().Where(post => post.GetInventorySpace() > 0).ToList();
        if (orderedPosts.Count == 0)
        {
            return false;
        }

        var post = orderedPosts[0];
        if (!post.IsLocationOnPost(Location))
        {
            var navFallback = new Action(() => { BuilderDepositInventoryToNearestMiningPost(); });
            if (!NavigateToBuilding(post, navFallback))
            {
                return false;
            }

            EnqueueAction(() => { BuilderDepositInventoryToNearestMiningPost(); });
            return true;
        }

        var accepted = post.Deposit(Inventory.Type!, Inventory.Amount);
        RemoveFromInventory(accepted);
        return HasInventory() ? BuilderDepositInventoryToNearestMiningPost() : BuilderStep1();
    }

    public bool BuilderStep1()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        var scaffold = EnsureBuilderAssignment(true);
        if (scaffold is null)
        {
            return HasInventory() ? BuilderDepositInventoryToNearestMiningPost() : false;
        }

        var scaffoldReservation = scaffold.GetMaterialReservation(this);
        var postReservation = BuilderSourcePost?.GetMaterialReservation(this);

        if (HasInventory())
        {
            if (scaffold.NeedsResource(Inventory.Type!))
            {
                return BuilderStep4();
            }

            scaffold.ReleaseMaterialReservation(this);
            return BuilderDepositInventoryToNearestMiningPost();
        }

        if (scaffoldReservation is not null && BuilderSourcePost is not null && postReservation is not null)
        {
            return BuilderStep3();
        }

        if (scaffoldReservation is not null && BuilderSourcePost is null)
        {
            scaffold.ReleaseMaterialReservation(this);
        }
        else if (scaffoldReservation is null && BuilderSourcePost is not null)
        {
            ClearBuilderSourcePost();
        }

        if (scaffold.NeedsAnyResource(true, this) && BuilderStep2())
        {
            return true;
        }

        if (scaffold.IsRecipeComplete() && scaffold.NeedsConstructionWork())
        {
            return BuilderStep5();
        }

        if (scaffold.IsRecipeComplete() && scaffold.IsConstructionComplete() && scaffold.TryCompleteConstruction(this))
        {
            return true;
        }

        ReleaseAssignedBuilding();
        return false;
    }

    public bool BuilderStep2()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        var scaffold = GetAssignedScaffolding();
        if (scaffold is null)
        {
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        var supplyOption = GetBuilderSupplyOptionForScaffold(scaffold, GetBuilderMiningPostPriorityList());
        if (supplyOption is null)
        {
            return false;
        }

        var scaffoldReserved = scaffold.ReserveMaterial(this, supplyOption.Value.ResourceType, supplyOption.Value.Amount);
        if (scaffoldReserved <= 0)
        {
            return false;
        }

        var postReserved = supplyOption.Value.Post.ReserveMaterial(this, supplyOption.Value.ResourceType, scaffoldReserved);
        if (postReserved != scaffoldReserved)
        {
            scaffold.ReleaseMaterialReservation(this);
            supplyOption.Value.Post.ReleaseMaterialReservation(this);
            return false;
        }

        BuilderSourcePost = supplyOption.Value.Post;

        if (supplyOption.Value.Post.IsLocationOnPost(Location))
        {
            return BuilderStep3();
        }

        var navFallback = new Action(() =>
        {
            scaffold.ReleaseMaterialReservation(this);
            ClearBuilderSourcePost();
            BuilderStep1();
        });

        if (!NavigateToBuilding(supplyOption.Value.Post, navFallback))
        {
            return false;
        }

        EnqueueAction(() => { BuilderStep3(); });
        return true;
    }

    public bool BuilderStep3()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        var scaffold = GetAssignedScaffolding();
        var post = BuilderSourcePost;
        var scaffoldReservation = scaffold?.GetMaterialReservation(this);
        var postReservation = post?.GetMaterialReservation(this);

        if (scaffold is null || post is null || scaffoldReservation is null || postReservation is null || scaffoldReservation.ResourceType != postReservation.ResourceType)
        {
            scaffold?.ReleaseMaterialReservation(this);
            ClearBuilderSourcePost();
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        if (HasInventory())
        {
            return BuilderStep4();
        }

        if (!post.IsLocationOnPost(Location))
        {
            var navFallback = new Action(() =>
            {
                scaffold.ReleaseMaterialReservation(this);
                ClearBuilderSourcePost();
                BuilderStep1();
            });

            if (!NavigateToBuilding(post, navFallback))
            {
                return false;
            }

            EnqueueAction(() => { BuilderStep3(); });
            return true;
        }

        var withdrawn = post.WithdrawReservedMaterial(this, System.Math.Min(GetInventorySpace(), scaffoldReservation.Amount));
        if (withdrawn is null || withdrawn.Amount <= 0)
        {
            scaffold.ReleaseMaterialReservation(this);
            ClearBuilderSourcePost();
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        if (AddToInventory(withdrawn.ResourceType, withdrawn.Amount) != withdrawn.Amount)
        {
            post.Deposit(withdrawn.ResourceType, withdrawn.Amount);
            scaffold.ReleaseMaterialReservation(this);
            ClearBuilderSourcePost();
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        BuilderSourcePost = null;
        return BuilderStep4();
    }

    public bool BuilderStep4()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        var scaffold = GetAssignedScaffolding();
        if (!HasInventory())
        {
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        if (scaffold is null || !scaffold.IsInProgress())
        {
            return BuilderDepositInventoryToNearestMiningPost();
        }

        if (!scaffold.NeedsResource(Inventory.Type!))
        {
            scaffold.ReleaseMaterialReservation(this);
            return BuilderDepositInventoryToNearestMiningPost();
        }

        if (!IsInBuildingWorkRange(scaffold))
        {
            var navFallback = new Action(() =>
            {
                scaffold.ReleaseMaterialReservation(this);
                BuilderDepositInventoryToNearestMiningPost();
            });

            if (!NavigateToBuilding(scaffold, navFallback))
            {
                return false;
            }

            EnqueueAction(() => { BuilderStep4(); });
            return true;
        }

        var accepted = scaffold.Deposit(Inventory.Type!, Inventory.Amount, this);
        RemoveFromInventory(accepted);
        return HasInventory() ? BuilderDepositInventoryToNearestMiningPost() : BuilderStep1();
    }

    public bool BuilderStep5()
    {
        if (!EnsureBuilderState())
        {
            return false;
        }

        var scaffold = GetAssignedScaffolding();
        if (scaffold is null || !scaffold.IsInProgress())
        {
            ReleaseAssignedBuilding();
            return false;
        }

        if (HasInventory())
        {
            return BuilderStep4();
        }

        if (!scaffold.IsRecipeComplete())
        {
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        if (!scaffold.NeedsConstructionWork())
        {
            return BuilderStep1();
        }

        if (!IsInBuildingWorkRange(scaffold))
        {
            var navFallback = new Action(() => { BuilderStep1(); });
            if (!NavigateToBuilding(scaffold, navFallback))
            {
                return false;
            }

            EnqueueAction(() => { BuilderStep5(); });
            return true;
        }

        var worked = scaffold.ApplyConstructionWork(BuilderWorkRate, this);
        if (worked <= 0)
        {
            EnqueueAction(() => { BuilderStep1(); });
            return false;
        }

        return true;
    }
}
