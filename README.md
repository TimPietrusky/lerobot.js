# LeRobot.js

> interact with your robot in JS, inspired by [LeRobot](https://github.com/huggingface/lerobot)

## Install

```bash
# Web library
npm install @lerobot/web

# Node.js library
npm install @lerobot/node

# CLI / terminal
npm install -g lerobot
```

## CLI Usage

```
npx lerobot@latest --help
```

->

```
Usage: lerobot [options] [command]

Control your robot with Node.js (inspired by LeRobot in Python)

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  find-port                     Find robot port with interactive cable detection
  calibrate [options]           Calibrate robot motors
  teleoperate|teleop [options]  Control robot through teleoperation
  release-motors [options]      Release robot motors for manual movement
  help [command]                display help for command
```

## Resources

- **LeRobot.js**: [Introduction post on Hugging Face](https://huggingface.co/blog/NERDDISCO/lerobotjs)
- **Documentation**:
  - [`@lerobot/web`](./packages/web/README.md) - Browser (WebSerial + WebUSB)
  - [`@lerobot/node`](./packages/node/README.md) - Node.js (Serialport)
  - [`lerobot`](./packages/cli/README.md) - CLI / terminal (using `@lerobot/node`)
- **Live Demo**: Try it online at [huggingface.co/spaces/NERDDISCO/LeRobot.js](https://huggingface.co/spaces/NERDDISCO/LeRobot.js)
