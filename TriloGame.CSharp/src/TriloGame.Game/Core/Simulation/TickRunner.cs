using TriloGame.Game.Core.Buildings;

namespace TriloGame.Game.Core.Simulation;

public static class TickRunner
{
    public static void RunTick(GameSession session)
    {
        var cave = session.Cave;
        if (cave is null)
        {
            return;
        }

        session.TickCount++;

        if (session.Danger)
        {
            cave.RefreshBfsField("enemy");
        }

        foreach (var creature in cave.Trilobites.ToArray())
        {
            creature.Move();
        }

        if (session.Danger)
        {
            cave.RefreshBfsField("colony");
            foreach (var creature in cave.Enemies.ToArray())
            {
                creature.Move();
            }
        }

        foreach (var building in cave.Buildings.ToArray())
        {
            building.Tick(cave);
        }
    }
}
