using System.Text;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Audio;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using TriloGame.Game.Audio;
using TriloGame.Game.Core.Buildings;
using TriloGame.Game.Core.Constants;
using TriloGame.Game.Core.Entities;
using TriloGame.Game.Core.Simulation;
using TriloGame.Game.Core.World;
using TriloGame.Game.Rendering;
using TriloGame.Game.Shared.Math;
using TriloGame.Game.UI.Input;
using TriloGame.Game.UI.Menu;
using TriloGame.Game.UI.Selection;
using TriloGame.Game.UI.Settings;

namespace TriloGame.Game;

public sealed partial class GameApp : Microsoft.Xna.Framework.Game
{
    private readonly GraphicsDeviceManager _graphics;
    private readonly AudioService _audio = new();
    private readonly InputController _input = new();
    private readonly CameraController _camera = new();
    private readonly MenuController _menu = new();
    private GameSession _session = new();
    private readonly HashSet<Trilobite> _selectedTrilobites = [];

    private SpriteBatch _spriteBatch = null!;
    private RenderingContext _rendering = null!;
    private object? _selectedObject;
    private string? _activeBfsDebugField;
    private bool _gamePaused = true;
    private bool _isGameOver;
    private bool _debugMenuOpen;
    private bool _settingsMenuOpen;
    private bool _showRoleLabels;
    private bool _leftPanActive;
    private bool _selectionDragActive;
    private double _tickSpeedMs = GameConstants.TickSpeedNormal;
    private double _tickAccumulatorMs;
    private Scaffolding? _floatingBuilding;
    private Rectangle? _selectionBoxBounds;
    private RoleRadialMenuState? _roleRadialMenu;

    public GameApp()
    {
        _graphics = new GraphicsDeviceManager(this);
        Content.RootDirectory = "Content";
        IsMouseVisible = true;
        Window.AllowUserResizing = true;
        Window.ClientSizeChanged += (_, _) => HandleViewportResize();
    }

    public GameSession Session => _session;

    public bool BuildMode => _floatingBuilding is not null;

    public MenuController Menu => _menu;

    public void PlayUiSelectSound()
    {
        _audio.Play(GameAudioCue.UiSelect);
    }

    public string BuildCrashDiagnostics()
    {
        var builder = new StringBuilder();

        builder.AppendLine("[Game]");
        builder.AppendLine($"Paused: {_gamePaused}");
        builder.AppendLine($"GameOver: {_isGameOver}");
        builder.AppendLine($"DebugMenuOpen: {_debugMenuOpen}");
        builder.AppendLine($"SettingsMenuOpen: {_settingsMenuOpen}");
        builder.AppendLine($"BuildMode: {BuildMode}");
        builder.AppendLine($"TickSpeedMs: {_tickSpeedMs}");
        builder.AppendLine($"TickAccumulatorMs: {_tickAccumulatorMs:0.###}");
        builder.AppendLine($"ActiveBfsDebugField: {_activeBfsDebugField ?? "none"}");
        builder.AppendLine($"Viewport: {Window.ClientBounds.Width}x{Window.ClientBounds.Height}");
        builder.AppendLine($"CameraOrigin: {FormatVector(_camera.CameraOrigin)}");
        builder.AppendLine($"CameraScale: {_camera.CurrentScale:0.###}");
        builder.AppendLine($"CameraViewCenter: {FormatVector(_camera.ViewCenter)}");
        builder.AppendLine();

        builder.AppendLine("[Input]");
        builder.AppendLine($"MousePoint: {_input.MousePoint.X}, {_input.MousePoint.Y}");
        builder.AppendLine($"MouseDelta: {_input.MouseDelta.X}, {_input.MouseDelta.Y}");
        builder.AppendLine($"Dragging: {_input.Dragging}");
        builder.AppendLine($"DragStart: {_input.DragStartPoint.X}, {_input.DragStartPoint.Y}");
        builder.AppendLine($"LeftPanActive: {_leftPanActive}");
        builder.AppendLine($"SelectionDragActive: {_selectionDragActive}");
        builder.AppendLine($"KeysHeld: {FormatPressedKeys()}");
        builder.AppendLine();

        builder.AppendLine("[UI]");
        builder.AppendLine($"MenuPanelOpen: {_menu.PanelOpen}");
        builder.AppendLine($"MenuActiveTab: {_menu.ActiveTab}");
        builder.AppendLine($"MenuAssignmentFilter: {_menu.AssignmentFilter}");
        builder.AppendLine($"SelectedObject: {DescribeSelectedObject()}");
        builder.AppendLine($"SelectedTrilobites: {FormatSelectedTrilobites()}");
        builder.AppendLine($"FloatingBuilding: {DescribeFloatingBuilding()}");
        builder.AppendLine($"RoleRadialMenu: {DescribeRoleRadialMenu()}");
        builder.AppendLine($"SelectionBox: {DescribeSelectionBox()}");
        builder.AppendLine();

        AppendSessionCrashDiagnostics(builder);
        return builder.ToString();
    }

    protected override void Initialize()
    {
        _graphics.PreferredBackBufferWidth = 1440;
        _graphics.PreferredBackBufferHeight = 900;
        _graphics.ApplyChanges();
        _camera.SetViewport(Window.ClientBounds.Width, Window.ClientBounds.Height);
        StartNewGame();
        base.Initialize();
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        var whitePixel = new Texture2D(GraphicsDevice, 1, 1);
        whitePixel.SetData([Color.White]);

        var sprites = new SpriteFactory();
        RegisterTexture(sprites, "empty", "Textures/EmptyTile");
        RegisterTexture(sprites, "wall", "Textures/CaveWall");
        RegisterTexture(sprites, "Algae", "Textures/AlgaeTile");
        RegisterTexture(sprites, "Sandstone", "Textures/SandTile");
        RegisterTexture(sprites, "Malachite", "Textures/MalachiteTile");
        RegisterTexture(sprites, "Magnetite", "Textures/MagnetiteTile");
        RegisterTexture(sprites, "Perotene", "Textures/PeroteneTile");
        RegisterTexture(sprites, "Ilmenite", "Textures/IlmeniteTile");
        RegisterTexture(sprites, "Cochinium", "Textures/CochiniumTile");
        RegisterTexture(sprites, "Trilobite", "Textures/Trilobite");
        RegisterTexture(sprites, "Enemy", "Textures/Enemy");
        RegisterTexture(sprites, "Scaffold", "Textures/Scaffold");
        RegisterTexture(sprites, "Queen", "Textures/Queen");
        RegisterTexture(sprites, "AlgaeFarm", "Textures/AlgaeFarm");
        RegisterTexture(sprites, "Storage", "Textures/Storage");
        RegisterTexture(sprites, "Smith", "Textures/Smith");
        RegisterTexture(sprites, "MiningPost", "Textures/MiningPost");
        RegisterTexture(sprites, "Radar", "Textures/Radar");
        RegisterTexture(sprites, "Barracks", "Textures/Barracks");
        RegisterTexture(sprites, "Selected", "Textures/Selected");
        RegisterTexture(sprites, "SelectedEdge", "Textures/SelectedEdge");
        RegisterTexture(sprites, "Path", "Textures/Path");
        RegisterTexture(sprites, "BackArrow", "Textures/BackArrow");

        _rendering = new RenderingContext
        {
            SpriteBatch = _spriteBatch,
            UiFont = Content.Load<SpriteFont>("Fonts/UiFont"),
            SmallFont = Content.Load<SpriteFont>("Fonts/SmallFont"),
            DebugFont = Content.Load<SpriteFont>("Fonts/DebugFont"),
            WhitePixel = whitePixel,
            Sprites = sprites,
            Camera = _camera
        };

        _audio.Register(GameAudioCue.BuildingFinished, Content.Load<SoundEffect>("Audio/BuildingFinished"));
        _audio.Register(GameAudioCue.TrilobiteBirth, Content.Load<SoundEffect>("Audio/TrilobiteBirth"));
        _audio.Register(GameAudioCue.TrilobiteSelected, Content.Load<SoundEffect>("Audio/TrilobiteSelected"));
        _audio.Register(GameAudioCue.UiSelect, Content.Load<SoundEffect>("Audio/UiSelect"));
        _audio.Register(GameAudioCue.VolumeSound, Content.Load<SoundEffect>("Audio/VolumeSound"));
    }

    protected override void Update(GameTime gameTime)
    {
        _input.BeginFrame();
        SyncSelectionIfRemoved();

        if (_input.KeyPressed(Keys.OemTilde))
        {
            ToggleDebugMenu();
        }

        if (HasLostQueen())
        {
            TriggerGameOver();
        }

        if (_isGameOver)
        {
            HandleGameOverInput();
            base.Update(gameTime);
            return;
        }

        if (_debugMenuOpen)
        {
            HandleDebugMenuInput();
            AdvanceSimulation(gameTime);
            base.Update(gameTime);
            return;
        }

        _menu.UpdateHover(_input.MousePoint, Window.ClientBounds.Size, _session);

        var settingsHandled = _input.LeftReleased && HandleSettingsClick(_input.MousePoint);
        if (settingsHandled)
        {
            _leftPanActive = false;
            _selectionDragActive = false;
            _selectionBoxBounds = null;
            _input.EndDrag();
        }

        if (_input.WheelDelta != 0 && !_input.Dragging)
        {
            var wheelHandled = SettingsCoversPoint(_input.MousePoint);
            if (!wheelHandled)
            {
                var scrollDelta = System.Math.Clamp(-_input.WheelDelta, -90, 90);
                wheelHandled = _menu.HandleWheel(_input.MousePoint, scrollDelta, Window.ClientBounds.Size, _session);
            }

            if (!wheelHandled)
            {
                if (_input.WheelDelta > 0)
                {
                    _camera.CurrentScale = MathF.Min(GameConstants.MaxScale, _camera.CurrentScale * (4f / 3f));
                }
                else
                {
                    _camera.CurrentScale = MathF.Max(GameConstants.MinScale, _camera.CurrentScale * 0.75f);
                }
            }
        }

        if (_input.LeftPressed)
        {
            _input.BeginDrag();
            _leftPanActive = CanStartLeftPan(_input.MousePoint);
        }

        if (_input.LeftHeld && _leftPanActive)
        {
            _input.UpdateDrag(GameConstants.DragThresholdPixels, _input.LeftHeld);
            if (_input.Dragging)
            {
                _camera.PanByScreenDelta(_input.MouseDelta.X, _input.MouseDelta.Y);
            }
        }

        if (_input.RightPressed)
        {
            if (_roleRadialMenu is null)
            {
                _input.BeginDrag();
                _selectionDragActive = ShouldStartSelectionDrag(_input.MousePoint);
                _selectionBoxBounds = _selectionDragActive
                    ? CreateScreenRectangle(_input.MousePoint, _input.MousePoint)
                    : null;
            }
        }

        if (_input.RightHeld)
        {
            if (_roleRadialMenu is null)
            {
                _input.UpdateDrag(GameConstants.DragThresholdPixels, _input.RightHeld);
                if (_selectionDragActive && _input.Dragging)
                {
                    _selectionBoxBounds = CreateScreenRectangle(_input.DragStartPoint, _input.MousePoint);
                }
            }
        }

        if (_input.RightReleased)
        {
            if (_selectionDragActive && _input.Dragging)
            {
                FinalizeSelectionBox();
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
            else if (!_input.Dragging && !_menu.CoversScreenPoint(_input.MousePoint, Window.ClientBounds.Size) && !SettingsCoversPoint(_input.MousePoint))
            {
                HandleWorldRightClick(_input.MousePoint);
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
            else
            {
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
        }

        if (_input.LeftReleased && !settingsHandled)
        {
            if (TryHandleRoleRadialClick(_input.MousePoint))
            {
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
            else if (!_input.Dragging && !SettingsCoversPoint(_input.MousePoint) && !_menu.HandleClick(_input.MousePoint, Window.ClientBounds.Size, this, _session))
            {
                HandleWorldClick(_input.MousePoint);
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
            else
            {
                _leftPanActive = false;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
                _input.EndDrag();
            }
        }

        HandleKeyboard(gameTime);
        if (HasLostQueen())
        {
            TriggerGameOver();
            base.Update(gameTime);
            return;
        }

        AdvanceSimulation(gameTime);

        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(Color.Black);
        _spriteBatch.Begin(samplerState: SamplerState.PointClamp);

        if (_session.Cave is not null)
        {
            DrawTiles(_session.Cave);
            DrawBuildings(_session.Cave);
            DrawCreatures(_session.Cave);
            DrawRoleLabels(_session.Cave);
            DrawSelection();
            DrawSelectionBox();
            DrawFloatingPreview();
            DrawDebugOverlay(_session.Cave);
        }

        if (_isGameOver)
        {
            DrawGameOverOverlay();
        }
        else
        {
            _menu.Draw(_rendering, Window.ClientBounds.Size, this, _session);
            DrawSettingsMenu();
            DrawRoleRadialMenu();
            DrawFocusHint();
            if (_debugMenuOpen)
            {
                DrawDebugMenuOverlay();
            }
        }

        _spriteBatch.End();
        base.Draw(gameTime);
    }

    public void BeginBuildingPlacement(Scaffolding scaffolding)
    {
        _floatingBuilding = scaffolding;
        _floatingBuilding.SetDisplayRotationTurns(0);
    }

    public void CleanActive(bool closeMenu = false)
    {
        _activeBfsDebugField = null;
        _floatingBuilding = null;
        _leftPanActive = false;
        _selectionDragActive = false;
        _selectionBoxBounds = null;
        _roleRadialMenu = null;
        _selectedObject = null;
        _selectedTrilobites.Clear();
        _menu.SetSelectedObject(null);
        if (closeMenu)
        {
            _menu.ClosePanel();
        }
    }

    private void StartNewGame()
    {
        _session = new GameSession();
        _session.AudioCueRequested += HandleAudioCueRequested;
        PopulateUnlockedBuildings();

        var cave = new Cave(_session);
        var initialColony = BuildInitialColony(cave);
        var spawnX = initialColony.QueenLocation.X;
        var spawnY = initialColony.QueenLocation.Y;

        cave.Spawn(new Trilobite("Jeffery", new GridPoint(spawnX + 2, spawnY), _session), cave.GetTile(new GridPoint(spawnX + 2, spawnY).ToString())!);
        cave.Spawn(new Trilobite("Quinton", new GridPoint(spawnX + 2, spawnY + 2), _session), cave.GetTile(new GridPoint(spawnX + 2, spawnY + 2).ToString())!);
        cave.Spawn(new Trilobite("Yeetmuncher", new GridPoint(spawnX, spawnY), _session), cave.GetTile(new GridPoint(spawnX, spawnY).ToString())!);
        cave.Spawn(new Trilobite("Sigma", new GridPoint(spawnX, spawnY + 2), _session), cave.GetTile(new GridPoint(spawnX, spawnY + 2).ToString())!);
        cave.RevealCave();

        _camera.CurrentScale = 1f;
        _camera.SetOrigin(new Vector2((spawnX * TileConstants.TileSize) + TileConstants.TileSize, (spawnY * TileConstants.TileSize) + TileConstants.TileSize));
        _activeBfsDebugField = null;
        _selectedObject = null;
        _floatingBuilding = null;
        _leftPanActive = false;
        _selectionDragActive = false;
        _selectionBoxBounds = null;
        _roleRadialMenu = null;
        _selectedTrilobites.Clear();
        _gamePaused = true;
        _isGameOver = false;
        _debugMenuOpen = false;
        _settingsMenuOpen = false;
        _showRoleLabels = false;
        _tickSpeedMs = GameConstants.TickSpeedNormal;
        _tickAccumulatorMs = 0d;
        _input.EndDrag();
        _menu.ResetState();
    }

    private void PopulateUnlockedBuildings()
    {
        _session.UnlockedBuildings.Add(new Factory(game => new AlgaeFarm(game), _session));
        _session.UnlockedBuildings.Add(new Factory(game => new Barracks(game), _session));
        _session.UnlockedBuildings.Add(new Factory(game => new MiningPost(game), _session));
        _session.UnlockedBuildings.Add(new Factory(game => new Radar(game), _session));
    }

    private void TriggerGameOver()
    {
        if (_isGameOver)
        {
            return;
        }

        _isGameOver = true;
        _gamePaused = true;
        _debugMenuOpen = false;
        _settingsMenuOpen = false;
        _selectionDragActive = false;
        _selectionBoxBounds = null;
        _roleRadialMenu = null;
        _tickAccumulatorMs = 0d;
        _input.EndDrag();
        CleanActive(true);
    }

    private void SetSelectedObject(object? selectedObject)
    {
        _roleRadialMenu = null;
        _selectionBoxBounds = null;
        _selectionDragActive = false;
        _selectedObject = selectedObject;
        _selectedTrilobites.Clear();
        if (selectedObject is Trilobite trilobite)
        {
            _selectedTrilobites.Add(trilobite);
        }

        _menu.SetSelectedObject(selectedObject);
        if (selectedObject is not null)
        {
            _menu.OpenPanel();
            if (selectedObject is not Trilobite)
            {
                CenterSelection(selectedObject);
            }
        }

        if (selectedObject is Trilobite)
        {
            _audio.Play(GameAudioCue.TrilobiteSelected);
        }
    }

    private void SetSelectedTrilobites(IEnumerable<Trilobite> trilobites, bool openMenuForSingle = false)
    {
        var selected = trilobites
            .Where(trilobite => trilobite.Cave is not null)
            .Distinct()
            .ToArray();

        _roleRadialMenu = null;
        _selectionBoxBounds = null;
        _selectionDragActive = false;
        _selectedTrilobites.Clear();
        foreach (var trilobite in selected)
        {
            _selectedTrilobites.Add(trilobite);
        }

        if (openMenuForSingle && selected.Length == 1)
        {
            SetSelectedObject(selected[0]);
            return;
        }

        if (selected.Length > 0)
        {
            _audio.Play(GameAudioCue.TrilobiteSelected);
        }

        _selectedObject = null;
        _menu.SetSelectedObject(null);
    }

    private void CenterSelection(object selectedObject)
    {
        var menuOffset = _menu.GetOpenPanelWidth(Window.ClientBounds.Size) / 2f;
        var focusPoint = selectedObject switch
        {
            Creature creature => GetCreatureWorldPosition(creature),
            Building building when building.Location is not null => new Vector2(
                building.Location.Value.X * TileConstants.TileSize,
                building.Location.Value.Y * TileConstants.TileSize),
            _ => Vector2.Zero
        };
        _camera.SetOrigin(focusPoint + new Vector2(menuOffset * (1f / _camera.CurrentScale), 0f));
    }
}

public sealed partial class GameApp
{
    private void HandleAudioCueRequested(GameAudioCue cue)
    {
        _audio.Play(cue);
    }

    private bool HasLostQueen()
    {
        var cave = _session.Cave;
        return cave is not null && cave.Buildings.Count > 0 && cave.GetQueenBuilding() is null;
    }

    private void HandleGameOverInput()
    {
        if (_input.LeftReleased && GetPlayAgainButtonBounds(Window.ClientBounds.Size).Contains(_input.MousePoint))
        {
            PlayUiSelectSound();
            StartNewGame();
        }
    }

    private void ToggleDebugMenu()
    {
        _debugMenuOpen = !_debugMenuOpen;
        if (_debugMenuOpen)
        {
            _settingsMenuOpen = false;
        }

        _input.EndDrag();
    }

    private void HandleDebugMenuInput()
    {
        if (_input.KeyPressed(Keys.Escape))
        {
            _debugMenuOpen = false;
            return;
        }

        if (!_input.LeftReleased)
        {
            return;
        }

        foreach (var button in BuildDebugMenuButtons(Window.ClientBounds.Size))
        {
            if (button.Enabled && button.Bounds.Contains(_input.MousePoint))
            {
                PlayUiSelectSound();
                InvokeDebugMenuAction(button.Action);
                return;
            }
        }
    }

    private bool SettingsCoversPoint(Point point)
    {
        var viewport = Window.ClientBounds.Size;
        if (SettingsMenuLayout.GetSettingsButtonBounds(viewport).Contains(point))
        {
            return true;
        }

        return _settingsMenuOpen && SettingsMenuLayout.GetPanelBounds(viewport).Contains(point);
    }

    private bool HandleSettingsClick(Point point)
    {
        var viewport = Window.ClientBounds.Size;
        var buttonBounds = SettingsMenuLayout.GetSettingsButtonBounds(viewport);
        if (buttonBounds.Contains(point))
        {
            PlayUiSelectSound();
            _settingsMenuOpen = !_settingsMenuOpen;
            if (_settingsMenuOpen)
            {
                _roleRadialMenu = null;
                _selectionDragActive = false;
                _selectionBoxBounds = null;
            }

            return true;
        }

        if (!_settingsMenuOpen)
        {
            return false;
        }

        var panelBounds = SettingsMenuLayout.GetPanelBounds(viewport);
        if (!panelBounds.Contains(point))
        {
            _settingsMenuOpen = false;
            return true;
        }

        var downBounds = SettingsMenuLayout.GetVolumeDownButtonBounds(panelBounds);
        if (downBounds.Contains(point))
        {
            ChangeVolumeSetting(-SettingsMenuLayout.VolumeStep);
            return true;
        }

        var upBounds = SettingsMenuLayout.GetVolumeUpButtonBounds(panelBounds);
        if (upBounds.Contains(point))
        {
            ChangeVolumeSetting(SettingsMenuLayout.VolumeStep);
            return true;
        }

        var barBounds = SettingsMenuLayout.GetVolumeBarBounds(panelBounds);
        if (barBounds.Contains(point))
        {
            SetVolumeSetting(SettingsMenuLayout.GetSnappedVolumeFromBar(barBounds, point.X));
            return true;
        }

        return true;
    }

    private void SetVolumeSetting(int volumePercent)
    {
        PlayUiSelectSound();
        if (_audio.SetVolumePercent(volumePercent))
        {
            _audio.Play(GameAudioCue.VolumeSound);
        }
    }

    private void ChangeVolumeSetting(int delta)
    {
        SetVolumeSetting(_audio.VolumePercent + delta);
    }

    private void InvokeDebugMenuAction(DebugMenuAction action)
    {
        switch (action)
        {
            case DebugMenuAction.Close:
                _debugMenuOpen = false;
                return;
            case DebugMenuAction.TogglePause:
                TogglePauseState();
                return;
            case DebugMenuAction.SingleTick:
                RunSingleTick();
                return;
            case DebugMenuAction.SpeedSlow:
                _tickSpeedMs = GameConstants.TickSpeedSlow;
                return;
            case DebugMenuAction.SpeedNormal:
                _tickSpeedMs = GameConstants.TickSpeedNormal;
                return;
            case DebugMenuAction.SpeedFast:
                _tickSpeedMs = GameConstants.TickSpeedFast;
                return;
            case DebugMenuAction.SpeedFastest:
                _tickSpeedMs = GameConstants.TickSpeedFastest;
                return;
            case DebugMenuAction.ShowQueenField:
                ShowBfsFieldDebug("queen");
                return;
            case DebugMenuAction.ShowEnemyField:
                ShowBfsFieldDebug("enemy");
                return;
            case DebugMenuAction.ShowColonyField:
                ShowBfsFieldDebug("colony");
                return;
            case DebugMenuAction.ClearField:
                _activeBfsDebugField = null;
                return;
            case DebugMenuAction.ToggleRoleLabels:
                _showRoleLabels = !_showRoleLabels;
                return;
            case DebugMenuAction.SpawnEnemy:
                SpawnDebugEnemy();
                RefreshBfsFieldDebug();
                return;
            default:
                return;
        }
    }

    private void SyncSelectionIfRemoved()
    {
        _selectedTrilobites.RemoveWhere(trilobite => trilobite.Cave is null);

        if (_roleRadialMenu is not null)
        {
            var remainingTargets = _roleRadialMenu.Targets
                .Where(trilobite => trilobite.Cave is not null)
                .Distinct()
                .ToArray();
            _roleRadialMenu = remainingTargets.Length == 0
                ? null
                : _roleRadialMenu with { Targets = remainingTargets };
        }

        if (_selectedObject is Building building && building.Cave is null)
        {
            CleanActive();
        }
        else if (_selectedObject is Trilobite trilobite && trilobite.Cave is null)
        {
            if (_selectedTrilobites.Count > 0)
            {
                _selectedObject = null;
                _menu.SetSelectedObject(null);
            }
            else
            {
                CleanActive();
            }
        }
        else if (_selectedObject is Creature creature && creature.Cave is null)
        {
            CleanActive();
        }
    }

    private void HandleKeyboard(GameTime gameTime)
    {
        if (_input.KeyPressed(Keys.Enter))
        {
            RunSingleTick();
        }

        if (_input.KeyPressed(Keys.Space))
        {
            TogglePauseState();
        }

        if (_gamePaused)
        {
            if (_input.KeyPressed(Keys.D1)) ShowBfsFieldDebug("queen");
            if (_input.KeyPressed(Keys.D2)) ShowBfsFieldDebug("enemy");
            if (_input.KeyPressed(Keys.D3)) ShowBfsFieldDebug("colony");
        }
        else
        {
            if (_input.KeyPressed(Keys.D1)) _tickSpeedMs = GameConstants.TickSpeedSlow;
            if (_input.KeyPressed(Keys.D2)) _tickSpeedMs = GameConstants.TickSpeedNormal;
            if (_input.KeyPressed(Keys.D3)) _tickSpeedMs = GameConstants.TickSpeedFast;
            if (_input.KeyPressed(Keys.D4)) _tickSpeedMs = GameConstants.TickSpeedFastest;
        }

        if (_input.KeyPressed(Keys.P))
        {
            SpawnDebugEnemy();
            RefreshBfsFieldDebug();
        }

        if (_input.KeyPressed(Keys.Escape))
        {
            _settingsMenuOpen = false;
            CleanActive(true);
        }

        if (_input.KeyPressed(Keys.R) && _floatingBuilding is not null)
        {
            _floatingBuilding.RotateMap();
            var nextRotation = (_floatingBuilding.GetDisplayRotationTurns() + 1) % 4;
            _floatingBuilding.SetDisplayRotationTurns(nextRotation);
            _floatingBuilding.TargetBuilding.SetDisplayRotationTurns(nextRotation);
        }

        if (_input.Dragging)
        {
            return;
        }

        var focusTarget = GetSelectedFocusTrilobite();
        if (focusTarget is not null && _input.KeyHeld(Keys.F))
        {
            CenterSelection(focusTarget);
            return;
        }

        var dt = (float)gameTime.ElapsedGameTime.TotalSeconds;
        var dx = 0f;
        var dy = 0f;
        if (_input.KeyHeld(Keys.W)) dy += GameConstants.KeyboardPanSpeedPixelsPerSecond * dt;
        if (_input.KeyHeld(Keys.S)) dy -= GameConstants.KeyboardPanSpeedPixelsPerSecond * dt;
        if (_input.KeyHeld(Keys.A)) dx += GameConstants.KeyboardPanSpeedPixelsPerSecond * dt;
        if (_input.KeyHeld(Keys.D)) dx -= GameConstants.KeyboardPanSpeedPixelsPerSecond * dt;
        if (dx != 0f || dy != 0f)
        {
            _camera.PanByScreenDelta(dx, dy);
        }
    }

    private void HandleWorldClick(Point point)
    {
        if (TryHitCreature(point, out var creature))
        {
            _roleRadialMenu = null;
            SetSelectedObject(ReferenceEquals(_selectedObject, creature) ? null : creature);
            return;
        }

        if (TryHitBuilding(point, out var building))
        {
            if (!BuildMode)
            {
                CleanActive();
                if (building.CanBeSelected())
                {
                    SetSelectedObject(building);
                }
            }

            return;
        }

        var tile = GetTileAtScreenPoint(point);
        if (tile is null)
        {
            return;
        }

        if (BuildMode && _floatingBuilding is not null)
        {
            var location = GridPoint.Parse(tile.Key);
            if (_session.Cave!.CanBuild(_floatingBuilding, location, true))
            {
                _session.Cave.Build(_floatingBuilding, location);
                _floatingBuilding = null;
                CleanActive();
            }

            return;
        }

        if (tile.Base == "wall")
        {
            _session.MineTile(_session.Cave!, tile.Key, "manual");
            return;
        }

        if (TryHandleManualMove(tile))
        {
            return;
        }

        CleanActive();
    }

    private void HandleWorldRightClick(Point point)
    {
        if (BuildMode)
        {
            _roleRadialMenu = null;
            return;
        }

        if (_selectedTrilobites.Count > 1)
        {
            OpenRoleRadialMenu(point.ToVector2(), _selectedTrilobites, anchorToCreature: false);
            return;
        }

        if (TryHitTrilobite(point, out var trilobite))
        {
            SetSelectedTrilobites([trilobite], openMenuForSingle: false);
            OpenRoleRadialMenu(GetCreatureScreenPosition(trilobite), _selectedTrilobites, anchorToCreature: true);
            return;
        }

        _roleRadialMenu = null;
    }

    private bool CanStartLeftPan(Point point)
    {
        return _roleRadialMenu is null
            && !_menu.CoversScreenPoint(point, Window.ClientBounds.Size)
            && !SettingsCoversPoint(point);
    }

    private bool ShouldStartSelectionDrag(Point point)
    {
        return !BuildMode
            && !_menu.CoversScreenPoint(point, Window.ClientBounds.Size)
            && !SettingsCoversPoint(point);
    }

    private void FinalizeSelectionBox()
    {
        if (_selectionBoxBounds is null)
        {
            return;
        }

        var selected = GetTrilobitesInScreenRectangle(_selectionBoxBounds.Value);
        if (selected.Count == 0)
        {
            CleanActive();
            return;
        }

        SetSelectedTrilobites(selected, openMenuForSingle: false);
    }

    private bool TryHandleManualMove(Tile tile)
    {
        if (_selectedTrilobites.Count == 0)
        {
            return false;
        }

        var destination = GridPoint.Parse(tile.Key);
        var movedAny = false;
        foreach (var trilobite in _selectedTrilobites.Where(trilobite => trilobite.Cave is not null))
        {
            movedAny = trilobite.NavigateTo(destination, trilobite.GetBehavior(), clearExisting: true) || movedAny;
        }

        return movedAny;
    }

    private bool TryHandleRoleRadialClick(Point point)
    {
        if (_roleRadialMenu is null)
        {
            return false;
        }

        var button = BuildRoleRadialButtons(_roleRadialMenu).FirstOrDefault(candidate => candidate.Bounds.Contains(point));
        if (button.Assignment is null)
        {
            _roleRadialMenu = null;
            return false;
        }

        PlayUiSelectSound();
        AssignRoleToTrilobites(_roleRadialMenu.Targets, button.Assignment);
        _roleRadialMenu = null;
        return true;
    }

    private void OpenRoleRadialMenu(Vector2 centerScreen, IEnumerable<Trilobite> targets, bool anchorToCreature)
    {
        var validTargets = targets
            .Where(trilobite => trilobite.Cave is not null)
            .Distinct()
            .ToArray();
        _roleRadialMenu = validTargets.Length == 0
            ? null
            : new RoleRadialMenuState(centerScreen, validTargets, anchorToCreature);
    }

    private void AssignRoleToTrilobites(IEnumerable<Trilobite> targets, string assignment)
    {
        foreach (var trilobite in targets.Where(trilobite => trilobite.Cave is not null).Distinct())
        {
            trilobite.Assignment = assignment;
            trilobite.RestartBehavior();
        }
    }

    private void ShowBfsFieldDebug(string fieldName)
    {
        _session.Cave?.RefreshBfsField(fieldName);
        _activeBfsDebugField = fieldName;
    }

    private void RunSingleTick()
    {
        TickRunner.RunTick(_session);
        RefreshBfsFieldDebug();
    }

    private void AdvanceSimulation(GameTime gameTime)
    {
        if (_gamePaused)
        {
            return;
        }

        _tickAccumulatorMs += gameTime.ElapsedGameTime.TotalMilliseconds;
        while (_tickAccumulatorMs >= _tickSpeedMs)
        {
            TickRunner.RunTick(_session);
            _tickAccumulatorMs -= _tickSpeedMs;
            if (HasLostQueen())
            {
                TriggerGameOver();
                break;
            }
        }
    }

    private void TogglePauseState()
    {
        CleanActive();
        _gamePaused = !_gamePaused;
    }

    private void RefreshBfsFieldDebug()
    {
        if (_activeBfsDebugField is not null)
        {
            _session.Cave?.RefreshBfsField(_activeBfsDebugField);
        }
    }

    private void DrawTiles(Cave cave)
    {
        foreach (var tile in cave.GetTiles().Where(cave.IsTileRevealed))
        {
            var key = tile.Base == "wall" ? "wall" : tile.Base;
            DrawTileTexture(key, GridPoint.Parse(tile.Key));
        }
    }

    private void DrawBuildings(Cave cave)
    {
        foreach (var building in cave.Buildings)
        {
            if (building is Scaffolding scaffold)
            {
                foreach (var tile in scaffold.TileArray.Where(cave.IsTileRevealed))
                {
                    var tilePoint = GridPoint.Parse(tile.Key);
                    DrawWorldTextureNative(
                        "Scaffold",
                        new Vector2(tilePoint.X * TileConstants.TileSize, tilePoint.Y * TileConstants.TileSize));
                }

                continue;
            }

            if (building.Location is null)
            {
                continue;
            }

            DrawWorldTextureNative(
                building.TextureKey,
                GetPlacedBuildingWorldCenter(building),
                building.GetDisplayRotationTurns() * MathF.PI / 2f,
                GetPlacedBuildingOrigin(building));
        }
    }

    private void DrawCreatures(Cave cave)
    {
        foreach (var trilobite in cave.Trilobites)
        {
            DrawWorldTextureNative(
                "Trilobite",
                new Vector2(trilobite.Location.X * TileConstants.TileSize, trilobite.Location.Y * TileConstants.TileSize) + trilobite.MovementOffset,
                trilobite.RotationRadians);
        }

        foreach (var enemy in cave.Enemies)
        {
            DrawWorldTextureNative(
                "Enemy",
                new Vector2(enemy.Location.X * TileConstants.TileSize, enemy.Location.Y * TileConstants.TileSize) + enemy.MovementOffset,
                enemy.RotationRadians);
        }
    }

    private void DrawRoleLabels(Cave cave)
    {
        if (!_showRoleLabels)
        {
            return;
        }

        foreach (var trilobite in cave.Trilobites)
        {
            var position = GetCreatureScreenPosition(trilobite);
            var label = GetAssignmentLabel(trilobite.Assignment);
            var size = _rendering.DebugFont.MeasureString(label);
            var bounds = new Rectangle(
                (int)MathF.Round(position.X - (size.X / 2f) - 8f),
                (int)MathF.Round(position.Y - (TileConstants.TileHalfSize * _camera.CurrentScale) - size.Y - 14f),
                (int)MathF.Round(size.X + 16f),
                (int)MathF.Round(size.Y + 8f));

            _spriteBatch.Draw(_rendering.WhitePixel, bounds, new Color(6, 12, 18, 210));
            DrawScreenBorder(bounds, new Color(127, 179, 196), 1);
            _spriteBatch.DrawString(
                _rendering.DebugFont,
                label,
                new Vector2(bounds.X + ((bounds.Width - size.X) / 2f), bounds.Y + ((bounds.Height - size.Y) / 2f)),
                new Color(230, 239, 245));
        }
    }

    private void DrawSelection()
    {
        if (_selectedTrilobites.Count > 0)
        {
            if (_selectedTrilobites.Count == 1)
            {
                var selectedTrilobite = _selectedTrilobites.First();
                var path = selectedTrilobite.GetQueuedPathPreview();
                if (path.Count > 1)
                {
                    for (var index = 1; index < path.Count; index++)
                    {
                        var previous = path[index - 1];
                        var current = path[index];
                        var dy = current.Y - previous.Y;
                        var midpoint = new Vector2(
                            (((previous.X + current.X) * 0.5f) * TileConstants.TileSize) + selectedTrilobite.MovementOffset.X,
                            (((previous.Y + current.Y) * 0.5f) * TileConstants.TileSize) + selectedTrilobite.MovementOffset.Y);
                        DrawWorldTextureNative("Path", midpoint, dy != 0 ? MathF.PI / 2f : 0f);
                    }
                }
            }

            foreach (var selectedTrilobite in _selectedTrilobites)
            {
                DrawWorldTextureNative(
                    "Selected",
                    new Vector2(selectedTrilobite.Location.X * TileConstants.TileSize, selectedTrilobite.Location.Y * TileConstants.TileSize) + selectedTrilobite.MovementOffset);
            }

            return;
        }

        if (_selectedObject is Creature creature)
        {
            var path = creature.GetQueuedPathPreview();
            if (path.Count > 1)
            {
                for (var index = 1; index < path.Count; index++)
                {
                    var previous = path[index - 1];
                    var current = path[index];
                    var dy = current.Y - previous.Y;
                    var midpoint = new Vector2(
                        (((previous.X + current.X) * 0.5f) * TileConstants.TileSize) + creature.MovementOffset.X,
                        (((previous.Y + current.Y) * 0.5f) * TileConstants.TileSize) + creature.MovementOffset.Y);
                    DrawWorldTextureNative("Path", midpoint, dy != 0 ? MathF.PI / 2f : 0f);
                }
            }

            DrawWorldTextureNative(
                "Selected",
                new Vector2(creature.Location.X * TileConstants.TileSize, creature.Location.Y * TileConstants.TileSize) + creature.MovementOffset);
        }
        else if (_selectedObject is Building building)
        {
            foreach (var tile in building.TileArray)
            {
                var tilePoint = GridPoint.Parse(tile.Key);
                foreach (var neighbor in tile.Neighbors)
                {
                    if (building.TileArray.Contains(neighbor))
                    {
                        continue;
                    }

                    var neighborPoint = GridPoint.Parse(neighbor.Key);
                    var dx = neighborPoint.X - tilePoint.X;
                    var dy = neighborPoint.Y - tilePoint.Y;
                    var midpoint = new Vector2(
                        (tilePoint.X * TileConstants.TileSize) + (dx * TileConstants.TileHalfSize),
                        (tilePoint.Y * TileConstants.TileSize) + (dy * TileConstants.TileHalfSize));
                    var origin = dy < 0 || dx < 0
                        ? new Vector2(TileConstants.TileHalfSize, 4f)
                        : new Vector2(TileConstants.TileHalfSize, 0f);
                    DrawWorldTextureNative(
                        "SelectedEdge",
                        midpoint,
                        dy == 0 ? MathF.PI / 2f : 0f,
                        origin);
                }
            }
        }
    }

    private void DrawSelectionBox()
    {
        if (_selectionBoxBounds is null || !_input.Dragging || !_selectionDragActive)
        {
            return;
        }

        _spriteBatch.Draw(_rendering.WhitePixel, _selectionBoxBounds.Value, new Color(88, 179, 214, 48));
        DrawScreenBorder(_selectionBoxBounds.Value, new Color(146, 213, 239), 2);
    }

    private void DrawRoleRadialMenu()
    {
        if (_roleRadialMenu is null)
        {
            return;
        }

        var center = _roleRadialMenu.CenterScreen;
        var gameplayBounds = SelectionFocusLayout.GetGameplayBounds(Window.ClientBounds.Size, _menu.GetOpenPanelWidth(Window.ClientBounds.Size));

        var title = _roleRadialMenu.Targets.Length == 1
            ? _roleRadialMenu.Targets[0].Name
            : $"{_roleRadialMenu.Targets.Length} Trilobites";
        var titleMeasure = _rendering.DebugFont.MeasureString(title);
        var titleBounds = RoleRadialLayout.GetLabelBounds(
            center,
            new Point((int)MathF.Ceiling(titleMeasure.X), (int)MathF.Ceiling(titleMeasure.Y)),
            gameplayBounds);
        DrawRoundedScreenFrame(titleBounds, new Color(7, 15, 22, 232), new Color(143, 205, 226), 2, 12);
        DrawScreenTextFittedCentered(title, titleBounds, Color.White, _rendering.DebugFont, minScale: 0.72f);

        foreach (var button in BuildRoleRadialButtons(_roleRadialMenu))
        {
            var hovered = button.Bounds.Contains(_input.MousePoint);
            var fill = button.Selected
                ? hovered ? new Color(197, 173, 124) : new Color(172, 148, 102)
                : hovered ? new Color(54, 82, 103) : new Color(28, 44, 57);
            var border = button.Selected
                ? hovered ? new Color(255, 233, 188) : new Color(233, 210, 159)
                : hovered ? new Color(185, 213, 224) : new Color(94, 128, 144);
            var textColor = button.Selected ? new Color(10, 23, 34) : Color.White;

            DrawRoundedScreenFrame(button.Bounds, fill, border, 2, 12);
            DrawScreenTextFittedCentered(button.Label, button.Bounds, textColor, _rendering.SmallFont, minScale: 0.62f);
        }
    }

    private void DrawFocusHint()
    {
        if (!TryGetFocusHintTarget(out _))
        {
            return;
        }

        var viewport = Window.ClientBounds.Size;
        var hintBounds = SelectionFocusLayout.GetFocusHintBounds(viewport, _menu.GetOpenPanelWidth(viewport));
        const string label = "F to focus";
        DrawRoundedScreenFrame(hintBounds, new Color(7, 15, 22, 224), new Color(143, 205, 226), 2, 14);
        DrawScreenTextFittedCentered(label, hintBounds, new Color(239, 247, 252), _rendering.SmallFont, minScale: 0.72f);
    }

    private void DrawSettingsMenu()
    {
        var viewport = Window.ClientBounds.Size;
        var buttonBounds = SettingsMenuLayout.GetSettingsButtonBounds(viewport);
        var buttonHovered = buttonBounds.Contains(_input.MousePoint);
        var buttonFill = _settingsMenuOpen
            ? buttonHovered ? new Color(39, 86, 109) : new Color(33, 75, 95)
            : buttonHovered ? new Color(20, 48, 68) : new Color(13, 33, 48);
        var buttonBorder = _settingsMenuOpen
            ? buttonHovered ? new Color(160, 221, 237) : new Color(140, 207, 224)
            : buttonHovered ? new Color(76, 116, 136) : new Color(53, 88, 106);
        var buttonText = _settingsMenuOpen ? Color.White : new Color(214, 231, 239);

        DrawRoundedScreenFrame(buttonBounds, buttonFill, buttonBorder, 2, 14);
        DrawGearIcon(new Rectangle(buttonBounds.X + 12, buttonBounds.Y + 10, 24, 24), buttonText);
        DrawScreenTextFittedCentered(
            "Settings",
            new Rectangle(buttonBounds.X + 40, buttonBounds.Y, buttonBounds.Width - 46, buttonBounds.Height),
            buttonText,
            _rendering.SmallFont,
            minScale: 0.72f);

        if (!_settingsMenuOpen)
        {
            return;
        }

        var panelBounds = SettingsMenuLayout.GetPanelBounds(viewport);
        var titleBounds = new Rectangle(panelBounds.X + 20, panelBounds.Y + 16, panelBounds.Width - 40, 26);
        var valueBounds = SettingsMenuLayout.GetVolumeValueBounds(panelBounds);
        var barBounds = SettingsMenuLayout.GetVolumeBarBounds(panelBounds);
        var downBounds = SettingsMenuLayout.GetVolumeDownButtonBounds(panelBounds);
        var upBounds = SettingsMenuLayout.GetVolumeUpButtonBounds(panelBounds);
        var hintBounds = SettingsMenuLayout.GetDismissHintBounds(panelBounds);
        var downHovered = downBounds.Contains(_input.MousePoint);
        var upHovered = upBounds.Contains(_input.MousePoint);
        var barHovered = barBounds.Contains(_input.MousePoint);

        DrawRoundedScreenFrame(panelBounds, new Color(8, 19, 29, 247), new Color(77, 122, 140), 3, 16);
        DrawScreenTextFittedCentered("Settings", titleBounds, Color.White, _rendering.UiFont, minScale: 0.72f);
        DrawScreenTextFittedCentered(
            $"Volume: {_audio.VolumePercent}%",
            valueBounds,
            new Color(216, 232, 239),
            _rendering.SmallFont,
            minScale: 0.72f);

        DrawRoundedScreenFrame(barBounds, new Color(10, 22, 32), barHovered ? new Color(159, 209, 224) : new Color(74, 114, 132), 2, 9);
        var innerBarBounds = new Rectangle(barBounds.X + 3, barBounds.Y + 3, Math.Max(0, barBounds.Width - 6), Math.Max(0, barBounds.Height - 6));
        var fillBounds = SettingsMenuLayout.GetVolumeFillBounds(innerBarBounds, _audio.VolumePercent);
        if (fillBounds.Width > 0 && fillBounds.Height > 0)
        {
            DrawRoundedScreenRect(fillBounds, new Color(120, 203, 226), Math.Min(7, fillBounds.Height / 2));
        }

        DrawRoundedScreenFrame(
            downBounds,
            downHovered ? new Color(32, 61, 80) : new Color(20, 43, 58),
            downHovered ? new Color(180, 219, 233) : new Color(107, 151, 169),
            2,
            12);
        DrawScreenTextFittedCentered("-", downBounds, Color.White, _rendering.UiFont, minScale: 0.72f);

        DrawRoundedScreenFrame(
            upBounds,
            upHovered ? new Color(32, 61, 80) : new Color(20, 43, 58),
            upHovered ? new Color(180, 219, 233) : new Color(107, 151, 169),
            2,
            12);
        DrawScreenTextFittedCentered("+", upBounds, Color.White, _rendering.UiFont, minScale: 0.72f);

        DrawScreenTextFittedCentered(
            "Click outside to close",
            hintBounds,
            new Color(149, 183, 198),
            _rendering.SmallFont,
            minScale: 0.7f);
    }

    private void DrawFloatingPreview()
    {
        if (_floatingBuilding is null)
        {
            return;
        }

        var tile = GetTileAtScreenPoint(_input.MousePoint);
        if (tile is null)
        {
            return;
        }

        var location = GridPoint.Parse(tile.Key);
        var canBuild = _session.Cave!.CanBuild(_floatingBuilding, location, true);
        DrawScreenTextureNative(
            _floatingBuilding.TargetBuilding.TextureKey,
            _input.MousePoint.ToVector2(),
            _floatingBuilding.GetDisplayRotationTurns() * MathF.PI / 2f,
            GetFloatingBuildingOrigin(_floatingBuilding),
            (canBuild ? Color.White : new Color(255, 96, 96)) * 0.7f);
    }

    private void DrawDebugOverlay(Cave cave)
    {
        if (_activeBfsDebugField is null || !_gamePaused)
        {
            return;
        }

        var field = cave.GetBfsField(_activeBfsDebugField);
        if (field is null)
        {
            return;
        }

        foreach (var tile in cave.GetTiles().Where(cave.IsTileRevealed))
        {
            var value = field.GetValueOrDefault(tile.Key, int.MaxValue);
            if (value == int.MaxValue)
            {
                continue;
            }

            var screen = _camera.WorldToScreen(new Vector2(GridPoint.Parse(tile.Key).X * TileConstants.TileSize, GridPoint.Parse(tile.Key).Y * TileConstants.TileSize));
            _spriteBatch.DrawString(_rendering.DebugFont, value.ToString(), screen - new Vector2(10f, 12f), Color.Gold);
        }
    }

    private void DrawGameOverOverlay()
    {
        var viewport = Window.ClientBounds.Size;
        var overlayBounds = new Rectangle(0, 0, viewport.X, viewport.Y);
        var cardBounds = GetGameOverCardBounds(viewport);
        var buttonBounds = GetPlayAgainButtonBounds(viewport);
        var buttonHovered = buttonBounds.Contains(_input.MousePoint);

        _spriteBatch.Draw(_rendering.WhitePixel, overlayBounds, new Color(7, 11, 16) * 0.82f);
        DrawRoundedScreenFrame(cardBounds, new Color(18, 31, 42), new Color(196, 172, 121), 2, 18);

        var title = "Game Over";
        var subtitle = "The Queen has died.";
        var hint = "Click below to start a fresh colony.";

        var titleSize = _rendering.UiFont.MeasureString(title);
        var subtitleSize = _rendering.SmallFont.MeasureString(subtitle);
        var hintSize = _rendering.SmallFont.MeasureString(hint);

        var titlePosition = new Vector2(cardBounds.Center.X, cardBounds.Y + 34f) - (titleSize / 2f);
        var subtitlePosition = new Vector2(cardBounds.Center.X, cardBounds.Y + 88f) - (subtitleSize / 2f);
        var hintPosition = new Vector2(cardBounds.Center.X, cardBounds.Y + 118f) - (hintSize / 2f);

        _spriteBatch.DrawString(_rendering.UiFont, title, titlePosition, Color.White);
        _spriteBatch.DrawString(_rendering.SmallFont, subtitle, subtitlePosition, new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, hint, hintPosition, new Color(171, 198, 208));

        var buttonFill = buttonHovered ? new Color(218, 190, 132) : new Color(201, 173, 118);
        var buttonBorder = buttonHovered ? new Color(255, 230, 176) : new Color(238, 215, 164);
        DrawRoundedScreenFrame(buttonBounds, buttonFill, buttonBorder, 2, 14);
        DrawScreenTextFittedCentered("Play Again", buttonBounds, new Color(10, 23, 34), _rendering.UiFont, minScale: 0.72f);
    }

    private void DrawDebugMenuOverlay()
    {
        var viewport = Window.ClientBounds.Size;
        var overlayBounds = new Rectangle(0, 0, viewport.X, viewport.Y);
        var panelBounds = GetDebugMenuBounds(viewport);
        var pointer = _input.MousePoint;

        _spriteBatch.Draw(_rendering.WhitePixel, overlayBounds, new Color(5, 10, 16) * 0.4f);
        _spriteBatch.Draw(_rendering.WhitePixel, panelBounds, new Color(13, 24, 34) * 0.96f);
        DrawScreenBorder(panelBounds, new Color(187, 163, 114), 2);

        _spriteBatch.DrawString(_rendering.UiFont, "Debug", new Vector2(panelBounds.X + 20f, panelBounds.Y + 18f), Color.White);

        var stateLine = $"Paused: {(_gamePaused ? "Yes" : "No")}   Danger: {(_session.Danger ? "Yes" : "No")}";
        var tickLine = $"Tick: {_session.TickCount}   Speed: {(int)_tickSpeedMs} ms";
        var bfsLine = $"BFS View: {(_activeBfsDebugField ?? "none")} (visible while paused)";
        var roleLine = $"Role Labels: {(_showRoleLabels ? "On" : "Off")}";

        _spriteBatch.DrawString(_rendering.SmallFont, stateLine, new Vector2(panelBounds.X + 20f, panelBounds.Y + 58f), new Color(215, 222, 228));
        _spriteBatch.DrawString(_rendering.SmallFont, tickLine, new Vector2(panelBounds.X + 20f, panelBounds.Y + 80f), new Color(215, 222, 228));
        _spriteBatch.DrawString(_rendering.SmallFont, bfsLine, new Vector2(panelBounds.X + 20f, panelBounds.Y + 102f), new Color(171, 198, 208));
        _spriteBatch.DrawString(_rendering.SmallFont, roleLine, new Vector2(panelBounds.X + 20f, panelBounds.Y + 124f), new Color(171, 198, 208));

        _spriteBatch.DrawString(_rendering.SmallFont, "Quick Controls", new Vector2(panelBounds.X + 20f, panelBounds.Y + 150f), new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, "Game Loop Speed", new Vector2(panelBounds.X + 20f, panelBounds.Y + 238f), new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, "BFS Debug", new Vector2(panelBounds.X + 20f, panelBounds.Y + 322f), new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, "Visual Debug", new Vector2(panelBounds.X + 20f, panelBounds.Y + 420f), new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, "Actions", new Vector2(panelBounds.X + 20f, panelBounds.Y + 486f), new Color(255, 214, 150));
        _spriteBatch.DrawString(_rendering.SmallFont, "` closes this panel. Hotkeys still work.", new Vector2(panelBounds.X + 20f, panelBounds.Bottom - 28f), new Color(141, 183, 199));

        foreach (var button in BuildDebugMenuButtons(viewport))
        {
            DrawDebugMenuButton(button, button.Bounds.Contains(pointer));
        }
    }

    private void DrawDebugMenuButton(DebugMenuButton button, bool hovered)
    {
        var fill = new Color(36, 50, 64);
        var border = new Color(96, 120, 138);
        var textColor = Color.White;

        if (!button.Enabled)
        {
            fill = new Color(26, 34, 42);
            border = new Color(60, 70, 80);
            textColor = new Color(128, 139, 148);
        }
        else if (button.Selected)
        {
            fill = hovered ? new Color(194, 171, 122) : new Color(170, 148, 102);
            border = hovered ? new Color(255, 232, 184) : new Color(235, 210, 158);
            textColor = new Color(10, 23, 34);
        }
        else if (hovered)
        {
            fill = new Color(64, 83, 101);
            border = new Color(210, 187, 136);
        }

        _spriteBatch.Draw(_rendering.WhitePixel, button.Bounds, fill);
        DrawScreenBorder(button.Bounds, border, 2);

        var font = button.Bounds.Height >= 40 ? _rendering.SmallFont : _rendering.DebugFont;
        var textSize = font.MeasureString(button.Label);
        var textPosition = new Vector2(button.Bounds.Center.X, button.Bounds.Center.Y) - (textSize / 2f);
        _spriteBatch.DrawString(font, button.Label, textPosition, textColor);
    }

    private IReadOnlyList<RoleRadialButton> BuildRoleRadialButtons(RoleRadialMenuState radialMenu)
    {
        var gameplayBounds = SelectionFocusLayout.GetGameplayBounds(Window.ClientBounds.Size, _menu.GetOpenPanelWidth(Window.ClientBounds.Size));
        var roles = new (string Assignment, string Label)[]
        {
            ("unassigned", "Unassigned"),
            ("miner", "Miner"),
            ("builder", "Builder"),
            ("farmer", "Farmer"),
            ("fighter", "Fighter")
        };

        var uniformAssignment = radialMenu.Targets
            .Select(trilobite => trilobite.Assignment)
            .Distinct(StringComparer.Ordinal)
            .SingleOrDefault();

        var buttons = new List<RoleRadialButton>(roles.Length);
        for (var index = 0; index < roles.Length; index++)
        {
            var angle = (-MathF.PI / 2f) + (index * (MathF.Tau / roles.Length));
            var bounds = RoleRadialLayout.GetButtonBounds(radialMenu.CenterScreen, angle, gameplayBounds);
            buttons.Add(new RoleRadialButton(
                roles[index].Assignment,
                roles[index].Label,
                bounds,
                string.Equals(uniformAssignment, roles[index].Assignment, StringComparison.Ordinal)));
        }

        return buttons;
    }

    private void DrawWorldTexture(string textureKey, GridPoint point, float rotation, Vector2 sizeScale, Color? color = null)
    {
        DrawWorldTexture(textureKey, point.ToVector2(), rotation, sizeScale, color);
    }

    private void DrawWorldTexture(string textureKey, Vector2 gridPoint, float rotation, Vector2 sizeScale, Color? color = null)
    {
        if (!_rendering.Sprites.TryGet(textureKey, out var texture))
        {
            return;
        }

        var world = new Vector2(gridPoint.X * TileConstants.TileSize, gridPoint.Y * TileConstants.TileSize);
        var scale = new Vector2(
            (TileConstants.TileSize * sizeScale.X * _camera.CurrentScale) / texture.Width,
            (TileConstants.TileSize * sizeScale.Y * _camera.CurrentScale) / texture.Height);

        _spriteBatch.Draw(
            texture,
            _camera.WorldToScreen(world),
            null,
            color ?? Color.White,
            rotation,
            new Vector2(texture.Width / 2f, texture.Height / 2f),
            scale,
            SpriteEffects.None,
            0f);
    }

    private void DrawTileTexture(string textureKey, GridPoint point, Color? color = null)
    {
        if (!_rendering.Sprites.TryGet(textureKey, out var texture))
        {
            return;
        }

        var centerWorld = new Vector2(point.X * TileConstants.TileSize, point.Y * TileConstants.TileSize);
        var topLeftWorld = centerWorld - new Vector2(TileConstants.TileHalfSize, TileConstants.TileHalfSize);
        var bottomRightWorld = centerWorld + new Vector2(TileConstants.TileHalfSize, TileConstants.TileHalfSize);

        var topLeftScreen = _camera.WorldToScreen(topLeftWorld);
        var bottomRightScreen = _camera.WorldToScreen(bottomRightWorld);

        var left = (int)MathF.Floor(topLeftScreen.X);
        var top = (int)MathF.Floor(topLeftScreen.Y);
        var right = (int)MathF.Ceiling(bottomRightScreen.X);
        var bottom = (int)MathF.Ceiling(bottomRightScreen.Y);
        var destination = new Rectangle(left, top, Math.Max(1, right - left), Math.Max(1, bottom - top));

        _spriteBatch.Draw(texture, destination, color ?? Color.White);
    }

    private void DrawWorldTextureNative(string textureKey, Vector2 worldPixels, float rotation = 0f, Vector2? origin = null, Color? color = null, Vector2? scale = null)
    {
        if (!_rendering.Sprites.TryGet(textureKey, out var texture))
        {
            return;
        }

        _spriteBatch.Draw(
            texture,
            _camera.WorldToScreen(worldPixels),
            null,
            color ?? Color.White,
            rotation,
            origin ?? new Vector2(texture.Width / 2f, texture.Height / 2f),
            scale ?? new Vector2(_camera.CurrentScale),
            SpriteEffects.None,
            0f);
    }

    private void DrawScreenTextureNative(string textureKey, Vector2 screenPosition, float rotation = 0f, Vector2? origin = null, Color? color = null, Vector2? scale = null)
    {
        if (!_rendering.Sprites.TryGet(textureKey, out var texture))
        {
            return;
        }

        _spriteBatch.Draw(
            texture,
            screenPosition,
            null,
            color ?? Color.White,
            rotation,
            origin ?? new Vector2(texture.Width / 2f, texture.Height / 2f),
            scale ?? new Vector2(_camera.CurrentScale),
            SpriteEffects.None,
            0f);
    }

    private void DrawScreenBorder(Rectangle bounds, Color color, int thickness)
    {
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X, bounds.Y, bounds.Width, thickness), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X, bounds.Bottom - thickness, bounds.Width, thickness), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X, bounds.Y, thickness, bounds.Height), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.Right - thickness, bounds.Y, thickness, bounds.Height), color);
    }

    private void DrawGearIcon(Rectangle bounds, Color color)
    {
        var iconSize = Math.Min(bounds.Width, bounds.Height);
        if (iconSize <= 0)
        {
            return;
        }

        var centerSize = Math.Max(8, iconSize / 2);
        var toothThickness = Math.Max(2, iconSize / 8);
        var toothLength = Math.Max(3, iconSize / 6);
        var centerBounds = new Rectangle(
            bounds.Center.X - (centerSize / 2),
            bounds.Center.Y - (centerSize / 2),
            centerSize,
            centerSize);
        DrawRoundedScreenRect(centerBounds, color, Math.Max(3, centerSize / 4));

        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(centerBounds.Center.X - (toothThickness / 2), bounds.Y, toothThickness, toothLength), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(centerBounds.Center.X - (toothThickness / 2), bounds.Bottom - toothLength, toothThickness, toothLength), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X, centerBounds.Center.Y - (toothThickness / 2), toothLength, toothThickness), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.Right - toothLength, centerBounds.Center.Y - (toothThickness / 2), toothLength, toothThickness), color);

        var diagonalTooth = Math.Max(3, toothThickness + 1);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X + toothThickness, bounds.Y + toothThickness, diagonalTooth, diagonalTooth), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.Right - toothThickness - diagonalTooth, bounds.Y + toothThickness, diagonalTooth, diagonalTooth), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X + toothThickness, bounds.Bottom - toothThickness - diagonalTooth, diagonalTooth, diagonalTooth), color);
        _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.Right - toothThickness - diagonalTooth, bounds.Bottom - toothThickness - diagonalTooth, diagonalTooth, diagonalTooth), color);
    }

    private void DrawRoundedScreenFrame(Rectangle bounds, Color fill, Color border, int thickness, int radius)
    {
        if (bounds.Width <= 0 || bounds.Height <= 0)
        {
            return;
        }

        var clampedRadius = Math.Clamp(radius, 0, Math.Min(bounds.Width, bounds.Height) / 2);
        DrawRoundedScreenRect(bounds, border, clampedRadius);
        if (thickness <= 0)
        {
            return;
        }

        var innerBounds = new Rectangle(
            bounds.X + thickness,
            bounds.Y + thickness,
            Math.Max(0, bounds.Width - (thickness * 2)),
            Math.Max(0, bounds.Height - (thickness * 2)));
        if (innerBounds.Width <= 0 || innerBounds.Height <= 0)
        {
            return;
        }

        DrawRoundedScreenRect(innerBounds, fill, Math.Max(0, clampedRadius - thickness));
    }

    private void DrawRoundedScreenRect(Rectangle bounds, Color color, int radius)
    {
        if (bounds.Width <= 0 || bounds.Height <= 0)
        {
            return;
        }

        var clampedRadius = Math.Clamp(radius, 0, Math.Min(bounds.Width, bounds.Height) / 2);
        if (clampedRadius <= 1)
        {
            _spriteBatch.Draw(_rendering.WhitePixel, bounds, color);
            return;
        }

        for (var row = 0; row < bounds.Height; row++)
        {
            var inset = GetRoundedInset(clampedRadius, row, bounds.Height);
            var width = bounds.Width - (inset * 2);
            if (width <= 0)
            {
                continue;
            }

            _spriteBatch.Draw(_rendering.WhitePixel, new Rectangle(bounds.X + inset, bounds.Y + row, width, 1), color);
        }
    }

    private static int GetRoundedInset(int radius, int row, int height)
    {
        if (radius <= 1)
        {
            return 0;
        }

        if (row < radius)
        {
            return GetCircleInset(radius, row);
        }

        var inverseRow = height - row - 1;
        return inverseRow < radius ? GetCircleInset(radius, inverseRow) : 0;
    }

    private static int GetCircleInset(int radius, int rowFromEdge)
    {
        var dy = radius - rowFromEdge - 0.5f;
        var chordHalfWidth = MathF.Sqrt(MathF.Max(0f, (radius * radius) - (dy * dy)));
        return Math.Max(0, radius - (int)MathF.Ceiling(chordHalfWidth));
    }

    private void DrawScreenTextFittedCentered(string text, Rectangle bounds, Color color, SpriteFont font, float minScale = 0.72f)
    {
        if (string.IsNullOrWhiteSpace(text) || bounds.Width <= 0 || bounds.Height <= 0)
        {
            return;
        }

        var scale = 1f;
        var textToDraw = text;
        var measure = font.MeasureString(textToDraw);
        if (measure.Y <= 0f)
        {
            return;
        }

        scale = MathF.Min(scale, bounds.Height / measure.Y);
        if (measure.X > bounds.Width)
        {
            var widthScale = bounds.Width / measure.X;
            if (widthScale >= minScale)
            {
                scale = MathF.Min(scale, widthScale);
            }
            else
            {
                scale = MathF.Min(scale, minScale);
                textToDraw = FitScreenTextToWidth(font, textToDraw, bounds.Width / scale);
                measure = font.MeasureString(textToDraw);
            }
        }

        scale = MathF.Min(scale, 1f);
        var scaledSize = measure * scale;
        var position = new Vector2(
            bounds.X + ((bounds.Width - scaledSize.X) / 2f),
            bounds.Y + MathF.Max(0f, (bounds.Height - scaledSize.Y) / 2f));
        _spriteBatch.DrawString(font, textToDraw, position, color, 0f, Vector2.Zero, scale, SpriteEffects.None, 0f);
    }

    private static string FitScreenTextToWidth(SpriteFont font, string text, float maxWidth)
    {
        if (string.IsNullOrEmpty(text) || maxWidth <= 0f)
        {
            return string.Empty;
        }

        if (font.MeasureString(text).X <= maxWidth)
        {
            return text;
        }

        const string ellipsis = "...";
        if (font.MeasureString(ellipsis).X > maxWidth)
        {
            return string.Empty;
        }

        var endIndex = text.Length;
        while (endIndex > 0)
        {
            var candidate = $"{text[..endIndex].TrimEnd()}{ellipsis}";
            if (font.MeasureString(candidate).X <= maxWidth)
            {
                return candidate;
            }

            endIndex--;
        }

        return ellipsis;
    }

    private static Vector2 GetPlacedBuildingWorldCenter(Building building)
    {
        var location = building.Location ?? GridPoint.Zero;
        return new Vector2(
            (location.X * TileConstants.TileSize) + ((building.Size.X - 1) * TileConstants.TileHalfSize),
            (location.Y * TileConstants.TileSize) + ((building.Size.Y - 1) * TileConstants.TileHalfSize));
    }

    private static Vector2 GetPlacedBuildingOrigin(Building building)
    {
        var baseSize = building.GetDisplayPivotBaseSize();
        return new Vector2(baseSize.X * TileConstants.TileHalfSize, baseSize.Y * TileConstants.TileHalfSize);
    }

    private static Vector2 GetFloatingBuildingOrigin(Scaffolding scaffolding)
    {
        var pivotBaseSize = scaffolding.TargetBuilding.GetDisplayPivotBaseSize();
        var width = pivotBaseSize.X * TileConstants.TileSize;
        var height = pivotBaseSize.Y * TileConstants.TileSize;
        var pivotX = (float)TileConstants.TileHalfSize;
        var pivotY = (float)TileConstants.TileHalfSize;

        switch (scaffolding.GetDisplayRotationTurns())
        {
            case 1:
                pivotY = height - TileConstants.TileHalfSize;
                break;
            case 2:
                pivotX = width - TileConstants.TileHalfSize;
                pivotY = height - TileConstants.TileHalfSize;
                break;
            case 3:
                pivotX = width - TileConstants.TileHalfSize;
                break;
        }

        return new Vector2(pivotX, pivotY);
    }

    private static Rectangle GetGameOverCardBounds(Point viewport)
    {
        var width = Math.Min(520, Math.Max(320, viewport.X - 48));
        var height = Math.Min(240, Math.Max(200, viewport.Y - 80));
        return new Rectangle((viewport.X - width) / 2, (viewport.Y - height) / 2, width, height);
    }

    private static Rectangle GetPlayAgainButtonBounds(Point viewport)
    {
        var cardBounds = GetGameOverCardBounds(viewport);
        const int width = 190;
        const int height = 54;
        return new Rectangle(cardBounds.Center.X - (width / 2), cardBounds.Bottom - 80, width, height);
    }

    private Rectangle GetDebugMenuBounds(Point viewport)
    {
        var width = Math.Min(430, Math.Max(340, viewport.X - 48));
        var height = Math.Min(610, Math.Max(520, viewport.Y - 48));
        return new Rectangle(24, 24, width, height);
    }

    private IReadOnlyList<DebugMenuButton> BuildDebugMenuButtons(Point viewport)
    {
        var panelBounds = GetDebugMenuBounds(viewport);
        var contentX = panelBounds.X + 20;
        var contentWidth = panelBounds.Width - 40;
        const int gap = 10;
        const int buttonHeight = 40;

        var thirdWidth = (contentWidth - (gap * 2)) / 3;
        var quarterWidth = (contentWidth - (gap * 3)) / 4;
        var halfWidth = (contentWidth - gap) / 2;

        return
        [
            new DebugMenuButton(
                DebugMenuAction.TogglePause,
                _gamePaused ? "Resume" : "Pause",
                new Rectangle(contentX, panelBounds.Y + 152, thirdWidth, buttonHeight),
                true,
                false),
            new DebugMenuButton(
                DebugMenuAction.SingleTick,
                "Step Tick",
                new Rectangle(contentX + thirdWidth + gap, panelBounds.Y + 152, thirdWidth, buttonHeight),
                true,
                false),
            new DebugMenuButton(
                DebugMenuAction.Close,
                "Close",
                new Rectangle(contentX + (thirdWidth * 2) + (gap * 2), panelBounds.Y + 152, thirdWidth, buttonHeight),
                true,
                false),
            new DebugMenuButton(
                DebugMenuAction.SpeedSlow,
                "500 ms",
                new Rectangle(contentX, panelBounds.Y + 240, quarterWidth, buttonHeight),
                true,
                TickSpeedMatches(GameConstants.TickSpeedSlow)),
            new DebugMenuButton(
                DebugMenuAction.SpeedNormal,
                "250 ms",
                new Rectangle(contentX + quarterWidth + gap, panelBounds.Y + 240, quarterWidth, buttonHeight),
                true,
                TickSpeedMatches(GameConstants.TickSpeedNormal)),
            new DebugMenuButton(
                DebugMenuAction.SpeedFast,
                "100 ms",
                new Rectangle(contentX + (quarterWidth * 2) + (gap * 2), panelBounds.Y + 240, quarterWidth, buttonHeight),
                true,
                TickSpeedMatches(GameConstants.TickSpeedFast)),
            new DebugMenuButton(
                DebugMenuAction.SpeedFastest,
                "50 ms",
                new Rectangle(contentX + (quarterWidth * 3) + (gap * 3), panelBounds.Y + 240, quarterWidth, buttonHeight),
                true,
                TickSpeedMatches(GameConstants.TickSpeedFastest)),
            new DebugMenuButton(
                DebugMenuAction.ShowQueenField,
                "Queen",
                new Rectangle(contentX, panelBounds.Y + 324, halfWidth, buttonHeight),
                true,
                string.Equals(_activeBfsDebugField, "queen", StringComparison.Ordinal)),
            new DebugMenuButton(
                DebugMenuAction.ShowEnemyField,
                "Enemy",
                new Rectangle(contentX + halfWidth + gap, panelBounds.Y + 324, halfWidth, buttonHeight),
                true,
                string.Equals(_activeBfsDebugField, "enemy", StringComparison.Ordinal)),
            new DebugMenuButton(
                DebugMenuAction.ShowColonyField,
                "Colony",
                new Rectangle(contentX, panelBounds.Y + 374, halfWidth, buttonHeight),
                true,
                string.Equals(_activeBfsDebugField, "colony", StringComparison.Ordinal)),
            new DebugMenuButton(
                DebugMenuAction.ClearField,
                "Clear",
                new Rectangle(contentX + halfWidth + gap, panelBounds.Y + 374, halfWidth, buttonHeight),
                true,
                _activeBfsDebugField is null),
            new DebugMenuButton(
                DebugMenuAction.ToggleRoleLabels,
                _showRoleLabels ? "Hide Role Labels" : "Show Role Labels",
                new Rectangle(contentX, panelBounds.Y + 446, contentWidth, buttonHeight),
                true,
                _showRoleLabels),
            new DebugMenuButton(
                DebugMenuAction.SpawnEnemy,
                "Spawn Debug Enemy",
                new Rectangle(contentX, panelBounds.Y + 512, contentWidth, buttonHeight),
                true,
                false)
        ];
    }

    private bool TickSpeedMatches(double tickSpeed)
    {
        return Math.Abs(_tickSpeedMs - tickSpeed) < 0.01d;
    }

    private static Rectangle CreateScreenRectangle(Point start, Point end)
    {
        var left = Math.Min(start.X, end.X);
        var top = Math.Min(start.Y, end.Y);
        var right = Math.Max(start.X, end.X);
        var bottom = Math.Max(start.Y, end.Y);
        return new Rectangle(left, top, Math.Max(1, right - left), Math.Max(1, bottom - top));
    }

    private IReadOnlyList<Trilobite> GetTrilobitesInScreenRectangle(Rectangle selection)
    {
        return _session.Cave?.Trilobites
            .Where(trilobite => selection.Contains(GetCreatureScreenPosition(trilobite)))
            .ToArray()
            ?? [];
    }

    private Trilobite? GetSelectedFocusTrilobite()
    {
        if (_selectedTrilobites.Count == 1)
        {
            return _selectedTrilobites.First();
        }

        return _selectedObject as Trilobite;
    }

    private bool TryGetFocusHintTarget(out Trilobite trilobite)
    {
        trilobite = GetSelectedFocusTrilobite()!;
        if (trilobite is null || trilobite.Cave is null || _input.KeyHeld(Keys.F))
        {
            return false;
        }

        var viewport = Window.ClientBounds.Size;
        var menuWidth = _menu.GetOpenPanelWidth(viewport);
        var screenPosition = GetCreatureScreenPosition(trilobite);
        if (SelectionFocusLayout.IsNearGameplayCenter(screenPosition, viewport, menuWidth))
        {
            return false;
        }

        return !SelectionFocusLayout.IsInsideGameplayBounds(screenPosition, viewport, menuWidth);
    }

    private Vector2 GetCreatureWorldPosition(Creature creature)
    {
        return new Vector2(creature.Location.X * TileConstants.TileSize, creature.Location.Y * TileConstants.TileSize) + creature.MovementOffset;
    }

    private Vector2 GetCreatureScreenPosition(Creature creature)
    {
        return _camera.WorldToScreen(GetCreatureWorldPosition(creature));
    }

    private static string GetAssignmentLabel(string assignment)
    {
        return assignment switch
        {
            "unassigned" => "Unassigned",
            "miner" => "Miner",
            "builder" => "Builder",
            "farmer" => "Farmer",
            "fighter" => "Fighter",
            _ => assignment
        };
    }

    private string FormatPressedKeys()
    {
        var pressedKeys = _input.CurrentKeyboard.GetPressedKeys();
        return pressedKeys.Length == 0
            ? "none"
            : string.Join(", ", pressedKeys.Select(key => key.ToString()));
    }

    private static string FormatVector(Vector2 vector)
    {
        return $"{vector.X:0.###}, {vector.Y:0.###}";
    }

    private string DescribeSelectedObject()
    {
        return _selectedObject switch
        {
            Trilobite trilobite => $"Trilobite:{trilobite.Name}@{trilobite.Location}",
            Creature creature => $"Creature:{creature.Name}@{creature.Location}",
            Building building => $"Building:{building.Name}@{building.Location?.ToString() ?? "none"}",
            null => "none",
            _ => _selectedObject.GetType().Name
        };
    }

    private string FormatSelectedTrilobites()
    {
        if (_selectedTrilobites.Count == 0)
        {
            return "none";
        }

        return string.Join(
            "; ",
            _selectedTrilobites.Select(trilobite =>
                $"{trilobite.Name}:{trilobite.Assignment}@{trilobite.Location} HP {trilobite.Health}/{trilobite.MaxHealth}"));
    }

    private string DescribeFloatingBuilding()
    {
        if (_floatingBuilding is null)
        {
            return "none";
        }

        return $"{_floatingBuilding.Name} -> {_floatingBuilding.TargetBuilding.Name} rot {_floatingBuilding.GetDisplayRotationTurns()}";
    }

    private string DescribeRoleRadialMenu()
    {
        if (_roleRadialMenu is null)
        {
            return "closed";
        }

        var targets = string.Join(", ", _roleRadialMenu.Targets.Select(target => target.Name));
        return $"open @ {FormatVector(_roleRadialMenu.CenterScreen)} targets [{targets}]";
    }

    private string DescribeSelectionBox()
    {
        return _selectionBoxBounds is null
            ? "none"
            : $"{_selectionBoxBounds.Value.X}, {_selectionBoxBounds.Value.Y}, {_selectionBoxBounds.Value.Width}, {_selectionBoxBounds.Value.Height}";
    }

    private void AppendSessionCrashDiagnostics(StringBuilder builder)
    {
        builder.AppendLine("[Session]");
        builder.AppendLine($"TickCount: {_session.TickCount}");
        builder.AppendLine($"Danger: {_session.Danger}");
        builder.AppendLine($"DebugEnemyCount: {_session.DebugEnemyCount}");
        builder.AppendLine($"Resources: {FormatResources()}");

        var cave = _session.Cave;
        if (cave is null)
        {
            builder.AppendLine("Cave: null");
            return;
        }

        builder.AppendLine($"RevealedTiles: {cave.RevealedTiles.Count}");
        builder.AppendLine($"ReachableTiles: {cave.ReachableTiles.Count}");
        builder.AppendLine($"Trilobites: {cave.Trilobites.Count}");
        builder.AppendLine($"Enemies: {cave.Enemies.Count}");
        builder.AppendLine($"Buildings: {cave.Buildings.Count}");

        var queen = cave.GetQueenBuilding();
        builder.AppendLine(queen is null
            ? "Queen: missing"
            : $"Queen: {queen.Location?.ToString() ?? "none"} HP {queen.Health}/{queen.MaxHealth}");

        builder.AppendLine($"BuildingSummary: {FormatBuildingSummary(cave)}");
        builder.AppendLine($"TrilobiteSummary: {FormatTrilobiteSummary(cave)}");
        builder.AppendLine($"EnemySummary: {FormatEnemySummary(cave)}");
    }

    private string FormatResources()
    {
        return string.Join(", ", _session.Resources.OrderBy(pair => pair.Key).Select(pair => $"{pair.Key}={pair.Value}"));
    }

    private static string FormatBuildingSummary(Cave cave)
    {
        if (cave.Buildings.Count == 0)
        {
            return "none";
        }

        return string.Join(
            "; ",
            cave.Buildings.Select(building =>
                $"{building.Name}@{building.Location?.ToString() ?? "none"} HP {building.Health}/{building.MaxHealth}"));
    }

    private static string FormatTrilobiteSummary(Cave cave)
    {
        if (cave.Trilobites.Count == 0)
        {
            return "none";
        }

        return string.Join(
            "; ",
            cave.Trilobites.Select(trilobite =>
                $"{trilobite.Name}:{trilobite.Assignment}@{trilobite.Location} HP {trilobite.Health}/{trilobite.MaxHealth}"));
    }

    private static string FormatEnemySummary(Cave cave)
    {
        if (cave.Enemies.Count == 0)
        {
            return "none";
        }

        return string.Join(
            "; ",
            cave.Enemies.Select(enemy =>
                $"{enemy.Name}@{enemy.Location} HP {enemy.Health}/{enemy.MaxHealth}"));
    }

    private Tile? GetTileAtScreenPoint(Point point)
    {
        var world = _camera.ScreenToWorld(point);
        var gridPoint = new GridPoint((int)MathF.Round(world.X / TileConstants.TileSize), (int)MathF.Round(world.Y / TileConstants.TileSize));
        return _session.Cave?.GetTile(gridPoint.ToString());
    }

    private bool TryHitTrilobite(Point point, out Trilobite trilobite)
    {
        foreach (var candidate in _session.Cave?.Trilobites ?? [])
        {
            if (GetCreatureHitBounds(candidate).Contains(point))
            {
                trilobite = candidate;
                return true;
            }
        }

        trilobite = null!;
        return false;
    }

    private bool TryHitCreature(Point point, out Creature creature)
    {
        foreach (var candidate in _session.Cave?.GetCreatures() ?? [])
        {
            if (GetCreatureHitBounds(candidate).Contains(point))
            {
                creature = candidate;
                return true;
            }
        }

        creature = null!;
        return false;
    }

    private bool TryHitBuilding(Point point, out Building building)
    {
        var halfSize = TileConstants.TileHalfSize * _camera.CurrentScale;
        foreach (var candidate in _session.Cave?.Buildings ?? [])
        {
            if (candidate.TileArray.Any(tile =>
            {
                var tilePoint = GridPoint.Parse(tile.Key);
                var screen = _camera.WorldToScreen(new Vector2(tilePoint.X * TileConstants.TileSize, tilePoint.Y * TileConstants.TileSize));
                return new Rectangle(
                    (int)MathF.Round(screen.X - halfSize),
                    (int)MathF.Round(screen.Y - halfSize),
                    (int)MathF.Round(halfSize * 2f),
                    (int)MathF.Round(halfSize * 2f)).Contains(point);
            }))
            {
                building = candidate;
                return true;
            }
        }

        building = null!;
        return false;
    }

    private Rectangle GetCreatureHitBounds(Creature creature)
    {
        var halfSize = TileConstants.TileHalfSize * _camera.CurrentScale;
        var screen = GetCreatureScreenPosition(creature);
        return new Rectangle(
            (int)MathF.Round(screen.X - halfSize),
            (int)MathF.Round(screen.Y - halfSize),
            (int)MathF.Round(halfSize * 2f),
            (int)MathF.Round(halfSize * 2f));
    }

    private void RegisterTexture(SpriteFactory sprites, string key, string assetName)
    {
        sprites.Register(key, Content.Load<Texture2D>(assetName));
    }

    private void HandleViewportResize()
    {
        if (Window.ClientBounds.Width <= 0 || Window.ClientBounds.Height <= 0)
        {
            return;
        }

        var oldWidth = (int)_camera.ViewCenter.X * 2;
        var oldHeight = (int)_camera.ViewCenter.Y * 2;
        _camera.HandleViewportResize(oldWidth, oldHeight, Window.ClientBounds.Width, Window.ClientBounds.Height);
    }

    private (GridPoint QueenLocation, GridPoint MiningPostLocation) BuildInitialColony(Cave cave)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            var queenLocation = new GridPoint(Random.Shared.Next(-10, 10), Random.Shared.Next(-10, 10));
            var queen = new Queen(_session);
            if (!cave.Build(queen, queenLocation))
            {
                continue;
            }

            var post = new MiningPost(_session);
            var postLocation = FindStarterMiningPostLocation(cave, post);
            if (postLocation is not null && cave.Build(post, postLocation.Value))
            {
                return (queenLocation, postLocation.Value);
            }

            cave.RemoveBuilding(queen, "initialPlacementRetry");
        }

        foreach (var queenLocation in cave.GetTiles().Select(tile => GridPoint.Parse(tile.Key)).OrderBy(point => GridPoint.ManhattanDistance(point, GridPoint.Zero)))
        {
            var queen = new Queen(_session);
            if (!cave.Build(queen, queenLocation))
            {
                continue;
            }

            var post = new MiningPost(_session);
            var postLocation = FindStarterMiningPostLocation(cave, post);
            if (postLocation is not null && cave.Build(post, postLocation.Value))
            {
                return (queenLocation, postLocation.Value);
            }

            cave.RemoveBuilding(queen, "initialPlacementRetry");
        }

        throw new InvalidOperationException("Failed to place the initial queen and starter mining post.");
    }

    private GridPoint? FindStarterMiningPostLocation(Cave cave, Building building)
    {
        var queenCenter = cave.GetQueenBuilding()?.GetCenter() ?? GridPoint.Zero;
        GridPoint? bestLocation = null;
        var bestDistance = int.MaxValue;

        foreach (var tile in cave.GetTiles())
        {
            var location = GridPoint.Parse(tile.Key);
            if (!cave.CanBuild(building, location) || !HasWallClearance(cave, building, location, 5))
            {
                continue;
            }

            var buildingCenter = new GridPoint(location.X + (building.Size.X / 2), location.Y + (building.Size.Y / 2));
            var distance = GridPoint.ManhattanDistance(buildingCenter, queenCenter);
            if (distance > 10)
            {
                continue;
            }

            if (distance < bestDistance)
            {
                bestDistance = distance;
                bestLocation = location;
            }
        }

        return bestLocation;
    }

    private bool HasWallClearance(Cave cave, Building building, GridPoint location, int minDistance)
    {
        for (var x = 0; x < building.Size.X; x++)
        {
            for (var y = 0; y < building.Size.Y; y++)
            {
                if (building.OpenMap[y][x] > 1)
                {
                    continue;
                }

                var tileLocation = new GridPoint(location.X + x, location.Y + y);
                for (var dx = -(minDistance - 1); dx <= minDistance - 1; dx++)
                {
                    for (var dy = -(minDistance - 1); dy <= minDistance - 1; dy++)
                    {
                        if (Math.Abs(dx) + Math.Abs(dy) >= minDistance)
                        {
                            continue;
                        }

                        var nearbyTile = cave.GetTile(new GridPoint(tileLocation.X + dx, tileLocation.Y + dy).ToString());
                        if (nearbyTile is null || nearbyTile.Base == "wall")
                        {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    private void SpawnDebugEnemy()
    {
        var cave = _session.Cave;
        if (cave is null)
        {
            return;
        }

        var occupiedKeys = cave.GetCreatures().Select(creature => creature.Location.ToString()).ToHashSet(StringComparer.Ordinal);
        var reachable = cave.GetReachableTiles().Where(tile => tile.CreatureFits() && !occupiedKeys.Contains(tile.Key)).ToArray();
        if (reachable.Length == 0)
        {
            return;
        }

        var spawnTile = reachable[Random.Shared.Next(reachable.Length)];
        cave.Spawn(new Enemy($"Debug Enemy {_session.DebugEnemyCount++}", GridPoint.Parse(spawnTile.Key), _session), spawnTile);
    }

    private enum DebugMenuAction
    {
        TogglePause,
        SingleTick,
        SpeedSlow,
        SpeedNormal,
        SpeedFast,
        SpeedFastest,
        ShowQueenField,
        ShowEnemyField,
        ShowColonyField,
        ClearField,
        ToggleRoleLabels,
        SpawnEnemy,
        Close
    }

    private readonly record struct DebugMenuButton(
        DebugMenuAction Action,
        string Label,
        Rectangle Bounds,
        bool Enabled,
        bool Selected);

    private readonly record struct RoleRadialButton(
        string? Assignment,
        string Label,
        Rectangle Bounds,
        bool Selected);

    private sealed record RoleRadialMenuState(
        Vector2 CenterScreen,
        Trilobite[] Targets,
        bool AnchorToCreature);
}
