# 🤖 lerobot.js

**State-of-the-art AI for real-world robotics in JavaScript/TypeScript**

A faithful TypeScript/JavaScript port of [Hugging Face's lerobot](https://github.com/huggingface/lerobot), bringing cutting-edge robotics AI to the JavaScript ecosystem with **zero Python dependencies**.

## ✨ Features

- 🔌 **USB Port Detection**: Find robot arm serial ports in Node.js CLI and browser
- 🌐 **Universal**: Works in Node.js, browsers, and Edge devices
- 🎯 **Python Faithful**: Identical UX and messaging to original lerobot
- 📱 **WebSerial**: Browser-native serial port access (Chrome/Edge 89+)
- 🚀 **Zero Dependencies**: No Python runtime required
- 📦 **Lightweight**: ~2.3KB package size

## 🚀 Quick Start

### CLI Usage (Node.js)

```bash
# Use directly without installation
npx lerobot find-port

# Or install globally
npm install -g lerobot
lerobot find-port
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
$ npx lerobot find-port

Finding all available ports for the MotorsBus.
Ports before disconnecting: ['COM3', 'COM4']
Remove the USB cable from your MotorsBus and press Enter when done.

The port of this MotorsBus is 'COM3'
Reconnect the USB cable.
```

#### Browser Example

1. Click "Show Available Ports" → Browser asks for permission
2. Grant access to your serial devices
3. See list of connected ports
4. Use "Find MotorsBus Port" for detection workflow

### Platform Support

| Platform    | Method                  | Requirements                        |
| ----------- | ----------------------- | ----------------------------------- |
| **Node.js** | `npx lerobot find-port` | Node.js 18+, Windows/macOS/Linux    |
| **Browser** | Web interface           | Chrome/Edge 89+, HTTPS or localhost |
| **Mobile**  | Browser                 | Chrome Android 105+                 |

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
- [ ] **Phase 3**: Robot calibration tools
- [ ] **Phase 4**: Dataset management and visualization
- [ ] **Phase 5**: Policy inference (ONNX.js)
- [ ] **Phase 6**: Training infrastructure

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
