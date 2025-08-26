# lerobot

Control robots with Node.js (serialport) on the CLI, inspired by [LeRobot](https://github.com/huggingface/lerobot)

## Install

```bash
# Use directly with npx
npx lerobot@latest find-port

# Or install globally
npm install -g lerobot
lerobot find-port
```

## Commands

### Find Port

Discover robot port with interactive cable detection. Matches Python lerobot's `find_port.py` exactly.

```bash
npx lerobot@latest find-port
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
npx lerobot@latest calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_follower_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--output` - Custom output path for calibration file

**Compatible with:** `python -m lerobot.calibrate`

Calibration files are saved to the same location as Python lerobot:

```
~/.cache/huggingface/lerobot/calibration/robots/{robot_type}/{robot_id}.json
```

This ensures calibration data is shared between Python and Node.js implementations.

### Teleoperate

Control robot through keyboard teleoperation.

```bash
npx lerobot@latest teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_follower_arm
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

**Compatible with:** `python -m lerobot.teleoperate`

### Release Motors

Release robot motors for manual movement.

```bash
npx lerobot@latest release-motors --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_follower_arm
```

**Options:**

- `--robot.type` - Robot type (e.g., `so100_follower`)
- `--robot.port` - Serial port (e.g., `/dev/ttyUSB0`, `COM4`)
- `--robot.id` - Robot identifier (default: `default`)
- `--motors` - Specific motor IDs to release (comma-separated)

**Note:** This command is specific to our Node.js implementation for convenient motor management.

## Examples

### Complete Workflow

```bash
# 1. Find your robot
npx lerobot@latest find-port
# Output: Detected port: /dev/ttyUSB0

# 2. Calibrate the robot
npx lerobot@latest calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm

# 3. Control the robot
npx lerobot@latest teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm --teleop.type=keyboard

# 4. Release motors when done
npx lerobot@latest release-motors --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

## Related Packages

- **[@lerobot/node](../node/)** - Node.js library based on serialport
- **[@lerobot/web](../web/)** - Browser library for web applications based on WebSerial and WebUSB
