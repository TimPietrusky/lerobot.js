# lerobot

Command-line interface for robot control with [@lerobot/node](https://www.npmjs.com/package/@lerobot/node) in Node.js (see [@lerobot/web](https://www.npmjs.com/package/@lerobot/web) for the browser version).

## Quick Start

```bash
# Install globally
npm install -g lerobot

# Or use directly with npx
npx lerobot@latest --help
```

### Complete Workflow

```bash
# 1. Find your robot port
lerobot find-port
# Output: The port of this MotorsBus is '/dev/ttyUSB0'

# 2. Calibrate the robot
lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm

# 3. Control the robot
lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm

# 4. Release motors when done
lerobot release-motors --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

### Help

```bash
# See all available commands
lerobot --help

# Get help for specific commands
lerobot calibrate --help
lerobot teleoperate --help
```

## Commands

### `find-port`

Interactive port discovery using cable detection.

```bash
lerobot find-port
```

**Process:**

1. Lists current ports
2. Prompts to unplug USB cable
3. Detects which port disappeared
4. Prompts to reconnect cable

### `calibrate`

Calibrate robot motors and save calibration data.

```bash
lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--output` - Custom output path for calibration file

**Storage Location:**

```
~/.cache/huggingface/lerobot/calibration/robots/{robot_type}/{robot_id}.json
```

### `teleoperate`

Control robot through keyboard input.

```bash
lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--teleop.type` - Teleoperator type (default: `keyboard`)
- `--duration` - Duration in seconds, 0 = unlimited (default: `0`)

**Keyboard Controls:**

- `w/s` - Elbow flex/extend
- `a/d` - Wrist down/up
- `q/e` - Wrist roll left/right
- `o/c` - Gripper open/close
- `Arrow keys` - Shoulder lift/pan
- `Ctrl+C` - Stop and exit

### `release-motors`

Release robot motors for manual positioning.

```bash
lerobot release-motors --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--motors` - Specific motor IDs to release (comma-separated)
