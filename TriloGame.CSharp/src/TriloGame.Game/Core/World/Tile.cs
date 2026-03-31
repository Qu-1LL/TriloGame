namespace TriloGame.Game.Core.World;

public sealed class Tile
{
    private readonly HashSet<Tile> _adjacent = [];
    private readonly List<Entities.Trilobite> _trilobites = [];

    public Tile(string key)
    {
        Key = key;
        Base = "empty";
        CreatureCanFit = true;
    }

    public string Key { get; }

    public string Base { get; private set; }

    public Buildings.Building? Built { get; private set; }

    public bool CreatureCanFit { get; set; }

    public IReadOnlyCollection<Tile> Neighbors => _adjacent;

    public IReadOnlyList<Entities.Trilobite> Trilobites => _trilobites;

    public void AddNeighbor(Tile tile)
    {
        if (tile == this)
        {
            return;
        }

        if (_adjacent.Add(tile))
        {
            tile._adjacent.Add(this);
        }
    }

    public void RemoveNeighbor(Tile tile)
    {
        if (_adjacent.Remove(tile))
        {
            tile._adjacent.Remove(this);
        }
    }

    public void SetBase(string tileBase)
    {
        Base = tileBase;
    }

    public void SetBuilt(Buildings.Building? building)
    {
        Built = building;
    }

    public bool CreatureFits() => CreatureCanFit;

    public bool AddTrilobite(Entities.Trilobite trilobite)
    {
        if (_trilobites.Contains(trilobite))
        {
            return false;
        }

        _trilobites.Add(trilobite);
        return true;
    }

    public bool RemoveTrilobite(Entities.Trilobite trilobite)
    {
        return _trilobites.Remove(trilobite);
    }

    public Tile? GetRandomNeighbor()
    {
        if (_adjacent.Count == 0)
        {
            return null;
        }

        var index = Shared.Utilities.RandomUtil.NextInt(_adjacent.Count);
        return _adjacent.ElementAt(index);
    }
}
