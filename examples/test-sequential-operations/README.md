# Test Sequential Operations

This example tests the complete robotics workflow: findPort → releaseMotors → calibrate → teleoperate.

## Purpose

Validates the full API chain and tests all major functions working together in sequence.

## Files

- `test-sequential-operations.html` - HTML page with test controls
- `test-sequential-operations.ts` - TypeScript implementation of sequential testing

## Running

From the root directory:

```bash
pnpm example:sequential-test
```

Or from this directory:

```bash
pnpm dev
```

## Testing Workflow

1. Click "🚀 Run Sequential Operations Test"
2. Workflow executes:
   - **findPort()** - Discovers and connects to robot
   - **releaseMotors()** - Releases motor torque for free movement
   - **calibrate()** - Records motor ranges (auto-stops after 8 seconds)
   - **teleoperate()** - Starts keyboard control with auto key simulation

## Expected Behavior

- Robot connection established
- Motors released for calibration setup
- Live calibration updates showing motor positions
- Automatic teleoperation with simulated key presses
- Auto-stop after test completion

## Browser Requirements

- Chrome/Edge 89+ with WebSerial and WebUSB APIs
- HTTPS or localhost
- Connected SO-100 robot arm for full testing
