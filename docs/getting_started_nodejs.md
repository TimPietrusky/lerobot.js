# Getting Started with SO-100 Robot Arms - lerobot.js (Node.js/TypeScript)

> **🚀 Complete setup guide for SO-100 robot arms using lerobot.js**  
> Zero Python dependencies - pure TypeScript/JavaScript implementation

## Prerequisites

- **Node.js 18+** (Windows, macOS, or Linux)
- **SO-100 robot arms** (follower + leader)
- **USB cables** for both arms

## 🚨 Current Implementation Status

**✅ Available Now:**

- `lerobot find-port` - USB port detection
- `lerobot calibrate` - Robot/teleoperator calibration

**🔄 Coming Soon (Python equivalent shown for reference):**

- `lerobot check-motors` - Motor ID verification
- `lerobot setup-motors` - Motor ID configuration
- `lerobot teleoperate` - Real-time control
- `lerobot record` - Data collection

> For now, use Python lerobot for motor setup, then switch to lerobot.js for calibration!

## Install lerobot.js

### Option 1: Global Installation (Recommended)

```bash
# Install globally for easy access
npm install -g lerobot

# Verify installation
lerobot --help
```

### Option 2: Use without Installation

```bash
# Use directly with npx (no installation needed)
npx lerobot --help
```

### Option 3: Development Setup

```bash
# Clone and build from source
git clone https://github.com/timpietrusky/lerobot.js
cd lerobot.js
pnpm install
pnpm run install-global
```

## 1. Identify USB Ports

**What this does:** Identifies which USB port each robot arm is connected to. Essential for all subsequent commands.

### Connect and Test

1. **Connect both arms**: Plug in USB + power for both follower and leader arms
2. **Run port detection**:

```bash
lerobot find-port
```

**Example output:**

```
Finding all available ports for the MotorsBus.
Ports before disconnecting: ['COM3', 'COM4']
Remove the USB cable from your MotorsBus and press Enter when done.

The port of this MotorsBus is 'COM3'
Reconnect the USB cable.
```

3. **Repeat for second arm**: Run `lerobot find-port` again to identify the other arm
4. **Record the ports**: Note which port belongs to which arm (e.g., COM3=leader, COM4=follower)

## 2. Check Motor IDs

**Important: Always do this first!** This checks if your robot motors are already configured correctly.

**What are motor IDs?** Each motor needs a unique ID (1, 2, 3, 4, 5, 6) so the computer can talk to them individually. New motors often have the same default ID (1).

### Check Follower Arm

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.check_motors --robot.port=COM4
```

### Check Leader Arm

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.check_motors --teleop.port=COM3
```

**✅ If you see this - you're ready for calibration:**

```
🎉 PERFECT! This arm is correctly configured:
   ✅ All 6 motors found: [1, 2, 3, 4, 5, 6]
   ✅ Correct baudrate: 1000000

✅ This arm is ready for calibration!
```

**⚠️ If you see this - continue to "Setup Motors" below:**

```
⚠️  This arm needs motor ID setup:
   Expected IDs: [1, 2, 3, 4, 5, 6]
   Found IDs: [1, 1, 1, 1, 1, 1]
   Duplicate IDs: [1] (likely all motors have ID=1)
```

## 3. Setup Motors (If Needed)

**⚠️ Only do this if the motor check above showed your motors need setup!**

This assigns unique ID numbers to each motor. It's a one-time process.

**Safety notes:**

- Power down (unplug power + USB) when connecting/disconnecting motors
- Connect only ONE motor at a time during setup
- Remove gears from leader arm before this step

### Setup Follower Arm

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.setup_motors --robot.type=so100_follower --robot.port=COM4
```

### Setup Leader Arm

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.setup_motors --teleop.type=so100_leader --teleop.port=COM3
```

**After setup:** Run the motor check commands again to verify everything worked.

## 4. Calibrate Robot Arms

**What is calibration?** Teaches both arms to understand joint positions identically. Crucial for leader arm to control follower arm properly.

**Why needed?** Manufacturing differences mean position sensors might read different values for the same physical position.

### Calibrate Follower Arm

```bash
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm
```

**Example output:**

```
Calibrating device...
Device type: so100_follower
Port: COM4
ID: my_follower_arm

Connecting to so100_follower on port COM4...
Connected successfully.
Starting calibration procedure...
Initializing robot communication...
Robot communication initialized.
Reading motor positions...
Motor positions: [0.5, 45.2, 90.1, 0.0, 0.0, 0.0]
Setting motor limits...
Motor limits configured.
Calibrating motors...
  Calibrating motor 1/6...
  Motor 1 calibrated successfully.
  [... continues for all 6 motors ...]
Verifying calibration...
Calibration verification passed.
Calibration completed successfully.
Configuration saved to: ~/.cache/huggingface/lerobot/calibration/robots/so100_follower/my_follower_arm.json
Disconnecting from robot...
```

**Calibration steps:**

1. **Move to neutral position**: Position arm in standard reference pose
2. **Move joints through range**: Gently move each joint to its limits
3. **Automatic save**: Calibration data saved automatically

### Calibrate Leader Arm

```bash
lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm
```

**Calibration steps:**

1. **Move to neutral position**: Same reference pose as follower
2. **Move through range**: Test all joint movements
3. **Button mapping**: Test all buttons and triggers
4. **Automatic save**: Configuration saved

**✅ After both arms are calibrated, you're ready for teleoperation!**

## 5. Test Teleoperation

Test that your leader arm can control the follower arm:

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.teleoperate \
  --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm \
  --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm
```

**Expected behavior:**

- Both arms connect automatically
- Moving leader arm → follower arm copies movements
- Press `Ctrl+C` to stop teleoperation

## 6. Record Demonstrations (Optional)

Record demonstrations for training robot learning policies:

```bash
# 🔄 Coming soon - use Python lerobot for now:
python -m lerobot.record \
  --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm \
  --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm \
  --dataset-name=my_first_dataset \
  --num-episodes=10 \
  --task="Pick up the red block and place it in the box"
```

## CLI Command Reference

### Core Commands

```bash
# Show all available commands
lerobot --help

# Find USB ports
lerobot find-port

# Calibrate robot
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Calibrate teleoperator
lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_teleop

# Show calibrate help
lerobot calibrate --help
```

### Alternative Usage Methods

```bash
# Method 1: Global installation (recommended)
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Method 2: Use with npx (no installation)
npx lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Method 3: Development mode (if you cloned the repo)
pnpm run cli:calibrate -- --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Method 4: Direct built CLI
node dist/cli/index.js calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot
```

## Configuration Files

Calibration data is stored in Hugging Face compatible directories:

```
~/.cache/huggingface/lerobot/calibration/
├── robots/
│   └── so100_follower/
│       └── my_follower_arm.json
└── teleoperators/
    └── so100_leader/
        └── my_leader_arm.json
```

**Environment variables:**

- `HF_HOME`: Override Hugging Face home directory
- `HF_LEROBOT_CALIBRATION`: Override calibration directory

## Troubleshooting

### Port Issues

```bash
# Error: Could not connect to robot on port COM99
lerobot find-port  # Re-run to find correct ports
```

**Solutions:**

1. Verify robot is connected to specified port
2. Check no other application is using the port
3. Verify you have permission to access the port
4. Try different USB port or cable

### Motor Communication Issues

```bash
# Error: Robot initialization failed
```

**Solutions:**

1. Check power connection to robot
2. Verify USB cable is working
3. Ensure motors are properly daisy-chained
4. Check motor IDs are correctly configured

### Permission Issues

**Windows:**

```bash
# Run as administrator if needed
```

**Linux/macOS:**

```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in
```

## Browser Usage (Alternative)

You can also use lerobot.js in the browser with Web Serial API:

1. **Build and serve**:

   ```bash
   git clone https://github.com/timpietrusky/lerobot.js
   cd lerobot.js
   pnpm install
   pnpm run build:web
   pnpm run preview
   ```

2. **Visit**: `http://localhost:4173`
3. **Requirements**: Chrome/Edge 89+ with HTTPS or localhost

## Next Steps

✅ **You now have working SO-100 robot arms with lerobot.js!**

**Continue with robot learning:**

- Add cameras for vision-based tasks
- Record more complex demonstrations
- Train neural network policies
- Run policies autonomously

**Resources:**

- [lerobot.js Documentation](https://github.com/timpietrusky/lerobot.js)
- [Original Python lerobot](https://github.com/huggingface/lerobot)
- [Hugging Face Robotics](https://huggingface.co/docs/lerobot)

**Community:**

- [Discord](https://discord.com/invite/s3KuuzsPFb) - Get help and discuss
- [GitHub Issues](https://github.com/timpietrusky/lerobot.js/issues) - Report bugs

---

**🎉 Congratulations! You're now ready to use SO-100 robot arms with TypeScript/JavaScript!**
