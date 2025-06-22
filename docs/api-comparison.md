# lerobot API Comparison: Python vs Node.js vs Web

This document provides a comprehensive three-way comparison of lerobot APIs across Python lerobot (original), Node.js lerobot.js, and Web lerobot.js platforms.

## 🔄 Core Function Comparison

| Function Category  | Python lerobot (Original) | Node.js lerobot.js            | Web Browser lerobot.js                                 | Key Pattern                                            |
| ------------------ | ------------------------- | ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| **Port Discovery** | `find_port()`             | `findPort()`                  | `findPortWeb(logger)`                                  | Python → Node.js: Direct port, Web: Requires UI logger |
| **Robot Creation** | `SO100Follower(config)`   | `createSO100Follower(config)` | `createWebTeleoperationController(port, serialNumber)` | Python: Class, Node.js: Factory, Web: Pre-opened port  |
| **Calibration**    | `calibrate(cfg)`          | `calibrate(config)`           | `createCalibrationController(armType, port)`           | Python/Node.js: Function, Web: Controller pattern      |
| **Teleoperation**  | `teleoperate(cfg)`        | `teleoperate(config)`         | `createWebTeleoperationController(port, serialNumber)` | Python/Node.js: Function, Web: Manual state management |

## 📋 Detailed API Reference

### Port Discovery

| Aspect               | Python lerobot                            | Node.js lerobot.js                           | Web Browser lerobot.js                         |
| -------------------- | ----------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| **Function**         | `find_port()`                             | `findPort()`                                 | `findPortWeb(logger)`                          |
| **Import**           | `from lerobot.find_port import find_port` | `import { findPort } from 'lerobot.js/node'` | `import { findPortWeb } from 'lerobot.js/web'` |
| **Parameters**       | None                                      | None                                         | `logger: (message: string) => void`            |
| **User Interaction** | Terminal prompts via `input()`            | Terminal prompts via readline                | Browser modals and buttons                     |
| **Port Access**      | Direct system access via pyserial         | Direct system access                         | Web Serial API permissions                     |
| **Return Value**     | None (prints to console)                  | None (prints to console)                     | None (calls logger function)                   |
| **Example**          | `python<br>find_port()<br>`               | `js<br>await findPort();<br>`                | `js<br>await findPortWeb(console.log);<br>`    |

### Robot Connection & Creation

| Aspect              | Python lerobot                                                                                                                     | Node.js lerobot.js                                                                                                                                   | Web Browser lerobot.js                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Creation**        | `SO100Follower(config)` or `make_robot_from_config(config)`                                                                        | `createSO100Follower(config)`                                                                                                                        | `createWebTeleoperationController(port, serialNumber)`                                                                                                                                         |
| **Connection**      | `robot.connect()`                                                                                                                  | `await robot.connect()`                                                                                                                              | Port already opened before creation                                                                                                                                                            |
| **Port Parameter**  | `RobotConfig(port='/dev/ttyUSB0')`                                                                                                 | `{ port: 'COM4' }` (string)                                                                                                                          | `SerialPort` object                                                                                                                                                                            |
| **Baud Rate**       | Handled internally                                                                                                                 | Handled internally                                                                                                                                   | `await port.open({ baudRate: 1000000 })`                                                                                                                                                       |
| **Factory Pattern** | `make_robot_from_config()` factory                                                                                                 | `createSO100Follower()` factory                                                                                                                      | `createWebTeleoperationController()` factory                                                                                                                                                   |
| **Example**         | `python<br>from lerobot.common.robots.so100_follower import SO100Follower<br>robot = SO100Follower(config)<br>robot.connect()<br>` | `js<br>const robot = createSO100Follower({<br>  type: 'so100_follower',<br>  port: 'COM4',<br>  id: 'my_robot'<br>});<br>await robot.connect();<br>` | `js<br>const port = await navigator.serial.requestPort();<br>await port.open({ baudRate: 1000000 });<br>const robot = await createWebTeleoperationController(<br>  port, 'my_robot'<br>);<br>` |

### Calibration

| Aspect              | Python lerobot                                                                                                                                                                                                                                       | Node.js lerobot.js                                                                                                                  | Web Browser lerobot.js                                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Main Function**   | `calibrate(cfg)`                                                                                                                                                                                                                                     | `calibrate(config)`                                                                                                                 | `createCalibrationController(armType, port)`                                                                                                                                                                                                                        |
| **Import**          | `from lerobot.calibrate import calibrate`                                                                                                                                                                                                            | `import { calibrate } from 'lerobot.js/node'`                                                                                       | `import { createCalibrationController } from 'lerobot.js/web'`                                                                                                                                                                                                      |
| **Configuration**   | `CalibrateConfig` dataclass                                                                                                                                                                                                                          | Single config object                                                                                                                | Controller with methods                                                                                                                                                                                                                                             |
| **Workflow**        | All-in-one function calls `device.calibrate()`                                                                                                                                                                                                       | All-in-one function                                                                                                                 | Step-by-step methods                                                                                                                                                                                                                                                |
| **Device Pattern**  | Creates device, calls `device.calibrate()`, `device.disconnect()`                                                                                                                                                                                    | Automatic within calibrate()                                                                                                        | Manual controller lifecycle                                                                                                                                                                                                                                         |
| **Homing**          | Automatic within `device.calibrate()`                                                                                                                                                                                                                | Automatic within calibrate()                                                                                                        | `await controller.performHomingStep()`                                                                                                                                                                                                                              |
| **Range Recording** | Automatic within `device.calibrate()`                                                                                                                                                                                                                | Automatic within calibrate()                                                                                                        | `await controller.performRangeRecordingStep()`                                                                                                                                                                                                                      |
| **Completion**      | Automatic save and disconnect                                                                                                                                                                                                                        | Automatic save                                                                                                                      | `await controller.finishCalibration()`                                                                                                                                                                                                                              |
| **Data Storage**    | File system (HF cache)                                                                                                                                                                                                                               | File system (HF cache)                                                                                                              | localStorage + file download                                                                                                                                                                                                                                        |
| **Example**         | `python<br>from lerobot.calibrate import calibrate<br>from lerobot.common.robots.so100_follower import SO100FollowerConfig<br>calibrate(CalibrateConfig(<br>  robot=SO100FollowerConfig(<br>    port='/dev/ttyUSB0', id='my_robot'<br>  )<br>))<br>` | `js<br>await calibrate({<br>  robot: {<br>    type: 'so100_follower',<br>    port: 'COM4',<br>    id: 'my_robot'<br>  }<br>});<br>` | `js<br>const controller = await createCalibrationController(<br>  'so100_follower', port<br>);<br>await controller.performHomingStep();<br>await controller.performRangeRecordingStep(stopCondition);<br>const results = await controller.finishCalibration();<br>` |

### Teleoperation

| Aspect                | Python lerobot                                                                                                                                                                                              | Node.js lerobot.js                                                                                                                                                       | Web Browser lerobot.js                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Main Function**     | `teleoperate(cfg)`                                                                                                                                                                                          | `teleoperate(config)`                                                                                                                                                    | `createWebTeleoperationController(port, serialNumber)`                                                                                                                                                                                                               |
| **Import**            | `from lerobot.teleoperate import teleoperate`                                                                                                                                                               | `import { teleoperate } from 'lerobot.js/node'`                                                                                                                          | `import { createWebTeleoperationController } from 'lerobot.js/web'`                                                                                                                                                                                                  |
| **Control Loop**      | `teleop_loop()` with `get_action()` and `send_action()`                                                                                                                                                     | Automatic 60 FPS loop                                                                                                                                                    | Manual start/stop with `controller.start()`                                                                                                                                                                                                                          |
| **Device Management** | Creates teleop and robot devices, connects both                                                                                                                                                             | Device creation handled internally                                                                                                                                       | Port opened externally, controller manages state                                                                                                                                                                                                                     |
| **Input Handling**    | Teleoperator `get_action()` method                                                                                                                                                                          | Terminal raw mode                                                                                                                                                        | Browser event listeners                                                                                                                                                                                                                                              |
| **Key State**         | Handled by teleoperator device                                                                                                                                                                              | Internal management                                                                                                                                                      | `controller.updateKeyState(key, pressed)`                                                                                                                                                                                                                            |
| **Configuration**     | `TeleoperateConfig` with separate robot/teleop configs                                                                                                                                                      | `js<br>{<br>  robot: { type, port, id },<br>  teleop: { type: 'keyboard' },<br>  fps: 60,<br>  step_size: 25<br>}<br>`                                                   | Built into controller                                                                                                                                                                                                                                                |
| **Example**           | `python<br>from lerobot.teleoperate import teleoperate<br>teleoperate(TeleoperateConfig(<br>  robot=SO100FollowerConfig(port='/dev/ttyUSB0'),<br>  teleop=SO100LeaderConfig(port='/dev/ttyUSB1')<br>))<br>` | `js<br>await teleoperate({<br>  robot: {<br>    type: 'so100_follower',<br>    port: 'COM4',<br>    id: 'my_robot'<br>  },<br>  teleop: { type: 'keyboard' }<br>});<br>` | `js<br>const controller = await createWebTeleoperationController(<br>  port, 'my_robot'<br>);<br>controller.start();<br>// Handle keyboard events manually<br>document.addEventListener('keydown', (e) => {<br>  controller.updateKeyState(e.key, true);<br>});<br>` |

### Motor Control

| Aspect                 | Python lerobot                                                                                                                           | Node.js lerobot.js                                                                                                                                         | Web Browser lerobot.js                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Get Positions**      | `robot.get_observation()` (includes motor positions)                                                                                     | `await robot.getMotorPositions()`                                                                                                                          | `controller.getMotorConfigs()` or `controller.getState()`                                                                                         |
| **Set Positions**      | `robot.send_action(action)` (dict format)                                                                                                | `await robot.setMotorPositions(positions)`                                                                                                                 | `await controller.setMotorPositions(positions)`                                                                                                   |
| **Position Format**    | `dict[str, float]` (action format)                                                                                                       | `Record<string, number>`                                                                                                                                   | `Record<string, number>` ✅ Same                                                                                                                  |
| **Data Flow**          | `get_observation()` → `send_action()` loop                                                                                               | Direct position get/set methods                                                                                                                            | Controller state management                                                                                                                       |
| **Action Features**    | `robot.action_features` (motor names)                                                                                                    | Motor names hardcoded in implementation                                                                                                                    | Motor configs with metadata                                                                                                                       |
| **Calibration Limits** | Handled in robot implementation                                                                                                          | `robot.getCalibrationLimits()`                                                                                                                             | `controller.getMotorConfigs()` (includes limits)                                                                                                  |
| **Home Position**      | Manual via action dict                                                                                                                   | Manual calculation                                                                                                                                         | `await controller.goToHomePosition()`                                                                                                             |
| **Example**            | `python<br>obs = robot.get_observation()<br>action = {motor: value for motor in robot.action_features}<br>robot.send_action(action)<br>` | `js<br>const positions = await robot.getMotorPositions();<br>await robot.setMotorPositions({<br>  shoulder_pan: 2047,<br>  shoulder_lift: 1800<br>});<br>` | `js<br>const state = controller.getState();<br>await controller.setMotorPositions({<br>  shoulder_pan: 2047,<br>  shoulder_lift: 1800<br>});<br>` |

### Calibration Data Management

| Aspect               | Node.js                                     | Web Browser                           |
| -------------------- | ------------------------------------------- | ------------------------------------- |
| **Storage Location** | `~/.cache/huggingface/lerobot/calibration/` | `localStorage` + file download        |
| **File Format**      | JSON files on disk                          | JSON in browser storage               |
| **Loading**          | Automatic during `robot.connect()`          | Manual via `loadCalibrationConfig()`  |
| **Saving**           | `robot.saveCalibration(results)`            | `saveCalibrationResults()` + download |
| **Persistence**      | Permanent until deleted                     | Browser-specific, can be cleared      |
| **Sharing**          | File system sharing                         | Manual file sharing                   |

### Error Handling & Debugging

| Aspect                | Node.js                  | Web Browser                          |
| --------------------- | ------------------------ | ------------------------------------ |
| **Connection Errors** | Standard Node.js errors  | Web Serial API errors                |
| **Permission Issues** | File system permissions  | User permission prompts              |
| **Port Conflicts**    | "Port in use" errors     | Silent failures or permission errors |
| **Debugging**         | Console.log + terminal   | Browser DevTools console             |
| **Logging**           | Built-in terminal output | Passed logger functions              |

## 🎯 Usage Pattern Summary

### Python lerobot (Original) - Research & Production

```python
# Configuration-driven, device-based approach
from lerobot.find_port import find_port
from lerobot.calibrate import calibrate, CalibrateConfig
from lerobot.teleoperate import teleoperate, TeleoperateConfig
from lerobot.common.robots.so100_follower import SO100FollowerConfig
from lerobot.common.teleoperators.so100_leader import SO100LeaderConfig

# Find port
find_port()

# Calibrate robot
calibrate(CalibrateConfig(
    robot=SO100FollowerConfig(port='/dev/ttyUSB0', id='my_robot')
))

# Teleoperation with leader-follower
teleoperate(TeleoperateConfig(
    robot=SO100FollowerConfig(port='/dev/ttyUSB0'),
    teleop=SO100LeaderConfig(port='/dev/ttyUSB1')
))
```

### Node.js lerobot.js - Server/Desktop Applications

```javascript
// High-level, all-in-one functions (mirrors Python closely)
import { findPort, calibrate, teleoperate } from "lerobot.js/node";

await findPort();
await calibrate({
  robot: { type: "so100_follower", port: "COM4", id: "my_robot" },
});
await teleoperate({
  robot: { type: "so100_follower", port: "COM4" },
  teleop: { type: "keyboard" },
});
```

### Web Browser lerobot.js - Interactive Applications

```javascript
// Controller-based, step-by-step approach (browser constraints)
import {
  findPortWeb,
  createCalibrationController,
  createWebTeleoperationController,
} from "lerobot.js/web";

// User interaction required
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 1000000 });

// Step-by-step calibration
const calibrator = await createCalibrationController("so100_follower", port);
await calibrator.performHomingStep();
await calibrator.performRangeRecordingStep(() => stopRecording);

// Manual teleoperation control
const controller = await createWebTeleoperationController(port, "my_robot");
controller.start();
```

## 🔑 Key Architectural Differences

1. **User Interaction Model**

   - **Node.js**: Terminal-based with readline prompts
   - **Web**: Browser UI with buttons and modals

2. **Permission Model**

   - **Node.js**: System-level permissions
   - **Web**: User-granted permissions per device

3. **State Management**

   - **Node.js**: Function-based, stateless
   - **Web**: Controller-based, stateful

4. **Data Persistence**

   - **Node.js**: File system with cross-session persistence
   - **Web**: Browser storage with limited persistence

5. **Platform Integration**
   - **Node.js**: Deep system integration
   - **Web**: Security-constrained browser environment

This comparison helps developers choose the right platform and understand the API differences when porting between Node.js and Web implementations.
