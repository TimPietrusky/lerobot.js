# lerobot

Python lerobot compatible CLI for Node.js. Provides the same command-line interface as Python lerobot with identical behavior and syntax.

## Installation

```bash
# Use directly with npx (recommended)
npx lerobot find-port

# Or install globally
npm install -g lerobot
lerobot find-port
```

## Commands

### Find Port

Discover robot port with interactive cable detection. Matches Python lerobot's `find_port.py` exactly.

```bash
# Interactive cable detection (always enabled, like Python lerobot)
lerobot find-port
```

This command follows Python lerobot's behavior exactly:

1. Lists initial ports
2. Prompts to unplug USB cable
3. Detects which port disappeared
4. Prompts to reconnect cable
5. Verifies port is restored

### Calibrate

Calibrate robot motors and save calibration data to Hugging Face cache.

```bash
lerobot calibrate \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_follower_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--output` - Custom output path for calibration file

**Compatible with:** `python -m lerobot calibrate`

### Teleoperate

Control robot through keyboard teleoperation.

```bash
lerobot teleoperate \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_follower_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--teleop.type` - Teleoperator type (default: `keyboard`)
- `--teleop.stepSize` - Step size for keyboard control (default: `25`)
- `--duration` - Duration in seconds, 0 = unlimited (default: `0`)

**Controls:**

- `w/s` - Motor 1 up/down
- `a/d` - Motor 2 left/right
- `q/e` - Motor 3 up/down
- `r/f` - Motor 4 forward/back
- `t/g` - Motor 5 up/down
- `y/h` - Motor 6 open/close
- `Ctrl+C` - Stop and exit

**Compatible with:** `python -m lerobot teleoperate`

### Release Motors

Release robot motors for manual movement.

```bash
lerobot release-motors \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_follower_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--motors` - Specific motor IDs to release (comma-separated)

**Compatible with:** `python -m lerobot release-motors`

## Python lerobot Compatibility

This CLI provides 100% compatible commands with Python lerobot:

| Python lerobot                     | Node.js lerobot              | Status        |
| ---------------------------------- | ---------------------------- | ------------- |
| `python -m lerobot find_port`      | `npx lerobot find-port`      | ✅ Compatible |
| `python -m lerobot calibrate`      | `npx lerobot calibrate`      | ✅ Compatible |
| `python -m lerobot teleoperate`    | `npx lerobot teleoperate`    | ✅ Compatible |
| `python -m lerobot release-motors` | `npx lerobot release-motors` | ✅ Compatible |

### Calibration Data Compatibility

Calibration files are saved to the same location as Python lerobot:

```
~/.cache/huggingface/lerobot/calibration/robots/{robot_type}/{robot_id}.json
```

This ensures calibration data is shared between Python and Node.js implementations.

## Examples

### Complete Workflow

```bash
# 1. Find your robot (interactive mode)
npx lerobot find-port --interactive
# Output: Detected port: /dev/ttyUSB0

# 2. Calibrate the robot
npx lerobot calibrate \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_arm

# 3. Control the robot
npx lerobot teleoperate \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_arm

# 4. Release motors when done
npx lerobot release-motors \
  --robot.type=so100_follower \
  --robot.port=/dev/ttyUSB0 \
  --robot.id=my_arm
```

### Automation Scripts

```bash
#!/bin/bash
# Automated calibration script

ROBOT_TYPE="so100_follower"
ROBOT_PORT="/dev/ttyUSB0"
ROBOT_ID="production_arm_1"

echo "Starting automated calibration..."
npx lerobot calibrate \
  --robot.type=$ROBOT_TYPE \
  --robot.port=$ROBOT_PORT \
  --robot.id=$ROBOT_ID

echo "Calibration complete. Starting teleoperation..."
npx lerobot teleoperate \
  --robot.type=$ROBOT_TYPE \
  --robot.port=$ROBOT_PORT \
  --robot.id=$ROBOT_ID \
  --duration=60  # Run for 60 seconds
```

## Requirements

- Node.js 18+
- Compatible with Windows, macOS, and Linux
- Same hardware requirements as Python lerobot

## Related Packages

- **[@lerobot/node](../node/)** - Node.js library for programmatic control
- **[@lerobot/web](../web/)** - Browser library for web applications

## License

Apache-2.0
