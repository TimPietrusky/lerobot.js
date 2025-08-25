# Node.js Quick Start Example (Vite)

This example demonstrates the complete workflow of using `@lerobot/node` to control robotics hardware from Node.js applications, using Vite for fast development and building. Follows the same pattern as the web Quick Start guide.

## What This Example Does

1. **Find Port**: Discovers and connects to your robot hardware
2. **Release Motors**: Puts motors in free-movement mode for setup
3. **Calibrate**: Records motor ranges and sets homing positions
4. **Teleoperate**: Enables keyboard control of the robot

## Hardware Requirements

- SO-100 robotic arm with STS3215 servos
- USB connection to your computer
- Compatible with Windows (COM ports), macOS, and Linux (/dev/tty\* ports)

## Installation

```bash
# Install dependencies (from project root)
pnpm install
```

## Running the Examples

### Full Workflow Demo

```bash
# Complete robot setup workflow (interactive)
pnpm demo:full-workflow
```

### Individual Component Demos

```bash
# Test port discovery
pnpm demo:find-port

# Test calibration (requires connected robot)
pnpm demo:calibrate

# Test keyboard control (requires calibrated robot)
pnpm demo:teleoperate
```

## Example Usage

The main demo (`src/main.ts`) shows the complete workflow:

```typescript
import { findPort, releaseMotors, calibrate, teleoperate } from "@lerobot/node";

// 1. Find and connect to robot
const findProcess = await findPort({ interactive: true });
const robots = await findProcess.result;
const robot = robots[0];

// 2. Configure robot type
robot.robotType = "so100_follower";
robot.robotId = "my_robot_arm";

// 3. Release motors for manual positioning
await releaseMotors(robot);

// 4. Calibrate motor ranges
const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => console.log(message),
});

// 5. Control robot with keyboard
const teleop = await teleoperate({
  robot,
  teleop: { type: "keyboard" },
});
```

## CLI Commands

You can also use the CLI directly:

```bash
# Find available ports
npx @lerobot/node find-port --interactive

# Calibrate robot
npx @lerobot/node calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0

# Control robot
npx @lerobot/node teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0
```

## Development

```bash
# Run with Vite Node (faster development with hot reload)
pnpm dev

# Build with Vite and run compiled version
pnpm build && pnpm start
```

## Safety Notes

⚠️ **Important Safety Guidelines:**

- Always ensure robot is in a safe position before running examples
- Keep emergency stop accessible (ESC key during teleoperation)
- Start with small movements to test calibration
- Ensure robot has adequate workspace clearance

## Troubleshooting

**Port Not Found:**

- Check USB connection
- Verify robot is powered on
- Try different USB ports/cables
- On Linux: Check user permissions for serial ports

**Calibration Issues:**

- Ensure motors are released and can move freely
- Move each joint through its full range slowly
- Avoid forcing motors past mechanical limits

**Control Problems:**

- Verify calibration completed successfully
- Check that calibration file was saved
- Restart the teleoperation if motors don't respond
