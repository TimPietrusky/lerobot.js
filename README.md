# 🤖 lerobot.js

**State-of-the-art AI for real-world robotics in JavaScript/TypeScript**

A faithful TypeScript/JavaScript port of [Hugging Face's lerobot](https://github.com/huggingface/lerobot), bringing cutting-edge robotics AI to the JavaScript ecosystem with **zero Python dependencies**.

## 🚀 **[Complete SO-100 Setup Guide →](docs/getting_started_nodejs.md)**

**Get your SO-100 robot arms working in 10 minutes with lerobot.js!**  
Step-by-step guide covering port detection, motor setup, calibration, and teleoperation.

## ✨ Features

- 🔌 **USB Port Detection**: Find robot arm serial ports in Node.js CLI and browser
- 🎛️ **Robot Calibration**: Complete SO-100 follower/leader calibration system
- 🌐 **Universal**: Works in Node.js, browsers, and Edge devices
- 🎯 **Python Faithful**: Identical UX and messaging to original lerobot
- 📱 **WebSerial**: Browser-native serial port access (Chrome/Edge 89+)
- 🚀 **Zero Dependencies**: No Python runtime required
- 📦 **Lightweight**: Pure TypeScript implementation

## 🚀 Quick Start

### Installation & Setup

```bash
# Option 1: Install globally (recommended)
npm install -g lerobot

# Option 2: Use directly with npx (no installation)
npx lerobot --help

# Verify installation
lerobot --help
```

### Essential Commands

```bash
# 1. Find USB ports for your robot arms
lerobot find-port

# 2. Calibrate follower robot
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm

# 3. Calibrate leader teleoperator
lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm

# Show command help
lerobot calibrate --help
```

### Alternative Usage Methods

```bash
# Method 1: Global CLI (after installation)
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Method 2: Direct with npx (no installation needed)
npx lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Method 3: Development setup (if you cloned the repo)
git clone https://github.com/timpietrusky/lerobot.js
cd lerobot.js && pnpm install && pnpm run install-global
```

### Browser Usage

1. **Development**:

   ```bash
   git clone https://github.com/timpietrusky/lerobot.js
   cd lerobot.js
   pnpm install
   pnpm run dev
   ```

2. **Visit**: `http://localhost:5173`

3. **Use the interface**:
   - Click "Show Available Ports" to see connected devices
   - Click "Find MotorsBus Port" for guided port detection

## 📖 Documentation

### Find USB Ports

Identify which USB ports your robot arms are connected to - essential for SO-100 setup.

#### CLI Example

```bash
$ lerobot find-port

Finding all available ports for the MotorsBus.
Ports before disconnecting: ['COM3', 'COM4']
Remove the USB cable from your MotorsBus and press Enter when done.

The port of this MotorsBus is 'COM3'
Reconnect the USB cable.
```

### Robot Calibration

Calibrate SO-100 robot arms for precise control and teleoperation.

#### Calibrate Follower Robot

```bash
$ lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm

Calibrating device...
Device type: so100_follower
Port: COM4
ID: my_follower_arm

Connecting to so100_follower on port COM4...
Connected successfully.
Starting calibration procedure...
[... calibration steps ...]
Calibration completed successfully.
Configuration saved to: ~/.cache/huggingface/lerobot/calibration/robots/so100_follower/my_follower_arm.json
Disconnecting from robot...
```

#### Calibrate Leader Teleoperator

```bash
$ lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm

Calibrating teleoperator...
[... guided calibration process ...]
Configuration saved to: ~/.cache/huggingface/lerobot/calibration/teleoperators/so100_leader/my_leader_arm.json
```

### Browser Interface

1. **Visit**: Built-in web interface with calibration controls
2. **Port Selection**: Browser dialog for device selection
3. **Interactive Calibration**: Step-by-step guided process
4. **File Download**: Automatic calibration file download

### Platform Support

| Platform    | Method                           | Requirements                        |
| ----------- | -------------------------------- | ----------------------------------- |
| **Node.js** | `lerobot find-port`, `calibrate` | Node.js 18+, Windows/macOS/Linux    |
| **Browser** | Web interface + calibration      | Chrome/Edge 89+, HTTPS or localhost |
| **Mobile**  | Browser                          | Chrome Android 105+                 |

### Browser Compatibility

The browser version uses the [WebSerial API](https://web.dev/serial/):

- ✅ **Chrome/Edge 89+** (Desktop)
- ✅ **Chrome Android 105+** (Mobile)
- ✅ **HTTPS** or localhost required
- ❌ Firefox/Safari (WebSerial not supported)

## 🛠️ Development

### Setup

```bash
git clone https://github.com/timpietrusky/lerobot.js
cd lerobot.js
pnpm install
```

### Scripts

```bash
# Development server (browser)
pnpm run dev

# Build CLI for Node.js
pnpm run build:cli

# Build web interface
pnpm run build:web

# Test CLI locally
pnpm run cli:find-port

# Build everything
pnpm run build
```

### Project Structure

```
src/
├── lerobot/
│   ├── node/
│   │   └── find_port.ts     # Node.js implementation
│   └── web/
│       └── find_port.ts     # Browser implementation (WebSerial)
├── cli/
│   └── index.ts             # CLI interface
├── main.ts                  # Web interface
└── web_interface.css        # UI styles
```

## 🎯 Design Principles

### 1. Python lerobot Faithfulness

- **Identical commands**: `npx lerobot find-port` ↔ `python -m lerobot.find_port`
- **Same terminology**: "MotorsBus", not "robot arms"
- **Matching output**: Error messages and workflows identical
- **Familiar UX**: Python lerobot users feel immediately at home

### 2. Platform Abstraction

- **Universal core**: Shared robotics logic
- **Adaptive UX**: CLI prompts vs. browser modals
- **Progressive enhancement**: Works everywhere, enhanced on capable platforms

### 3. Zero Dependencies

- **Node.js**: Only uses built-in modules + lightweight `serialport`
- **Browser**: Native WebSerial API, no external libraries
- **Deployment**: Single package, no Python runtime needed

## 🔧 Technical Details

### WebSerial API

The browser implementation leverages modern web APIs:

```typescript
// Request permission to access serial ports
await navigator.serial.requestPort();

// List granted ports
const ports = await navigator.serial.getPorts();

// Detect disconnected devices
const removedPorts = portsBefore.filter(/* ... */);
```

### CLI Implementation

Node.js version uses the `serialport` library for cross-platform compatibility:

```typescript
import { SerialPort } from "serialport";

// Cross-platform port detection
const ports = await SerialPort.list();
```

## 🗺️ Roadmap

- [x] **Phase 1**: USB port detection (CLI + Browser)
- [ ] **Phase 2**: Motor communication and setup
- [x] **Phase 3**: Robot calibration tools ✅ **COMPLETE!**
- [ ] **Phase 4**: Dataset management and visualization
- [ ] **Phase 5**: Policy inference (ONNX.js)
- [ ] **Phase 6**: Training infrastructure

### ✅ Recently Completed

**Phase 3 - Robot Calibration (December 2024)**

- Complete SO-100 follower/leader calibration system
- CLI commands identical to Python lerobot
- Web browser calibration interface
- HF-compatible configuration storage
- Comprehensive error handling and validation

## 📋 CLI Command Reference

### Available Commands

```bash
# Show all commands
lerobot --help

# Find USB ports
lerobot find-port

# Calibrate robot
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=ROBOT_ID

# Calibrate teleoperator
lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=TELEOP_ID

# Show calibration help
lerobot calibrate --help
```

### Configuration Files

Calibration data follows Hugging Face directory structure:

```
~/.cache/huggingface/lerobot/calibration/
├── robots/
│   └── so100_follower/
│       └── ROBOT_ID.json
└── teleoperators/
    └── so100_leader/
        └── TELEOP_ID.json
```

**Environment Variables:**

- `HF_HOME`: Override Hugging Face home directory
- `HF_LEROBOT_CALIBRATION`: Override calibration directory

## 🤝 Contributing

We welcome contributions! This project follows the principle of **Python lerobot faithfulness** - all features should maintain identical UX to the original.

### Guidelines

1. Check Python lerobot implementation first
2. Maintain identical command structure and messaging
3. Follow snake_case file naming convention
4. Test on both Node.js and browser platforms

## 📄 License

Apache 2.0 - Same as original lerobot

## 🙏 Acknowledgments

- [Hugging Face lerobot team](https://github.com/huggingface/lerobot) for the original Python implementation
- [WebSerial API](https://web.dev/serial/) for browser-native hardware access
- [serialport](https://github.com/serialport/node-serialport) for Node.js cross-platform support

---

**Built with ❤️ for the robotics community**
