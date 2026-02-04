# Scene Save Files

This directory contains saved scene state files in YAML format.

## Format

Scene save files use YAML format for human-readability and compatibility with many tools:
- Text editors (VS Code, Notepad++, etc.)
- YAML validators
- Version control systems (Git)
- Data processing tools

## File Structure

```yaml
scene:
  name: "TestScene"
  type: "TestScene"

entities:
  - id: 0
    components:
      Position:
        x: 0.0
        y: 0.0
      Velocity:
        x: 0.0
        y: 0.0
      Size:
        width: 16.0
        height: 16.0
      Sprite:
        spriteName: "player_idle_down"
        tintR: 1.0
        tintG: 1.0
        tintB: 1.0
        tintA: 1.0
        flipX: false
        flipY: false
      Animation:
        currentFrame: 0
        animationTime: 0.0
        frameRate: 10.0
        loop: true
      PlayerInput:
        speed: 120.0
      AABB:
        offsetX: 0.0
        offsetY: 0.0
        width: 16.0
        height: 16.0
      Player: true
      CameraTarget:
        smoothing: 0.15

scene_data:
  fence_tiles: []
```

## Usage

### Saving
- Press **F5** in-game to save the current scene state
- Or call `scene.saveScene("path/to/file.yaml")` programmatically

### Loading
- Press **F6** in-game to load the saved scene state
- Or call `scene.loadScene("path/to/file.yaml")` programmatically
- Scene will automatically restore sprite sheet references based on sprite names

## Supported Components

The serializer supports the following ECS components:
- `Position` - Entity world position
- `Velocity` - Entity velocity
- `Size` - Entity dimensions
- `Sprite` - Sprite rendering info (name, tint, flip flags)
- `Animation` - Animation state (frame, time, rate, loop)
- `PlayerInput` - Player movement speed
- `AABB` - Collision box
- `Player` - Player tag component
- `CameraTarget` - Camera follow settings

## Notes

- Sprite sheet pointers are not saved (they're pointers). The scene restores them based on sprite names after loading.
- Entity IDs are saved for reference but are regenerated on load.
- Scene-specific data (like fence tiles) can be extended in the serializer.
