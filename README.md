# 🤖 lerobot.js

JavaScript/TypeScript robotics library for Node.js and browsers. Control hardware directly without Python dependencies.

## Install

```bash
# CLI tools
npm install -g lerobot

# Web library
npm install @lerobot/web
```

## CLI Usage

```bash
# Find hardware
lerobot find-port

# Calibrate device
lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_robot

# Show help
lerobot --help
```

## Web Usage

```typescript
import { findPort, calibrate, teleoperate } from "@lerobot/web";

// Find and connect to hardware
const devices = await findPort();
const robot = devices[0];

// Calibrate
const calibration = await calibrate(robot);
await calibration.result;

// Control
const controller = await teleoperate(robot);
controller.start();
```

## Hardware Support

- **SO-100**: Follower/leader robot arms
- **WebSerial API**: Chrome/Edge 89+, HTTPS required
- **Node.js**: Cross-platform serial port access

## Demo

```bash
git clone https://github.com/timpietrusky/lerobot.js
cd lerobot.js && npm install && npm run dev
```

Visit `http://localhost:5173` for the web interface.

## License

Apache-2.0
