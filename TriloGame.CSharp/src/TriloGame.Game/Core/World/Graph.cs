namespace TriloGame.Game.Core.World;

public class Graph
{
    protected readonly Dictionary<string, Tile> Tiles = new(StringComparer.Ordinal);

    public Tile AddTile(string key)
    {
        if (!Tiles.TryGetValue(key, out var tile))
        {
            tile = new Tile(key);
            Tiles[key] = tile;
        }

        return tile;
    }

    public Tile? RemoveTile(string key)
    {
        if (!Tiles.TryGetValue(key, out var deleted))
        {
            return null;
        }

        foreach (var neighbor in deleted.Neighbors.ToArray())
        {
            neighbor.RemoveNeighbor(deleted);
        }

        Tiles.Remove(key);
        return deleted;
    }

    public void AddEdge(string left, string right)
    {
        var a = AddTile(left);
        var b = AddTile(right);
        a.AddNeighbor(b);
    }

    public Tile? GetTile(string key) => Tiles.GetValueOrDefault(key);

    public IReadOnlyList<Tile> GetTiles() => Tiles.Values.ToArray();
}
