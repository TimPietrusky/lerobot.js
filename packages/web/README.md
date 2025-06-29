# @lerobot/web

Control robotics hardware directly from the browser using WebSerial API.

## Install

```bash
npm install @lerobot/web
```

## Quick Start

```typescript
import { findPort, calibrate, teleoperate } from "@lerobot/web";

// 1. Find hardware
const devices = await findPort();
const robot = devices[0];

// 2. Calibrate
const calibration = await calibrate(robot);
await calibration.result;

// 3. Control
const controller = await teleoperate(robot);
controller.start();
```

## API

### `findPort(options?)`

Detects connected hardware. Returns `RobotConnection[]`.

### `calibrate(robot, options?)`

Calibrates motors and records ranges. Returns `CalibrationProcess`.

### `teleoperate(robot, options?)`

Enables real-time control. Returns `TeleoperationProcess`.

## Browser Support

- Chrome/Edge 89+
- Requires HTTPS or localhost
- [WebSerial API](https://caniuse.com/web-serial) support

## Hardware

Currently supports SO-100 follower/leader arms. More devices coming.

## License

Apache-2.0
