# lerobot.js - Cyberpunk Demo

**Real-world robotics control in the browser** - A comprehensive demonstration of lerobot.js capabilities with cyberpunk aesthetics.

🚀 **[Try the live demo →](https://huggingface.co/spaces/NERDDISCO/LeRobot.js)**

## What is lerobot.js?

**lerobot.js** is a TypeScript/JavaScript implementation of [Hugging Face lerobot](https://github.com/huggingface/lerobot) - bringing state-of-the-art AI for real-world robotics directly to the JavaScript ecosystem.

### Available Packages

- **[@lerobot/web](https://www.npmjs.com/package/@lerobot/web)** - Browser robotics with Web Serial API
- **[@lerobot/node](https://www.npmjs.com/package/@lerobot/node)** - Node.js robotics library with serialport
- **[lerobot](https://www.npmjs.com/package/lerobot)** - CLI tool (Python lerobot compatible)

## Quick Start

### Browser (This Demo)

```bash
# Clone and run this cyberpunk demo
git clone https://github.com/timpietrusky/lerobot.js
cd lerobot.js/examples/cyberpunk-standalone
pnpm install
pnpm dev
```

Visit `http://localhost:5173` with Chrome/Edge 89+ and connect your robot hardware.

### Node.js Library

```bash
# Install the Node.js library
pnpm add @lerobot/node

# Use in your TypeScript/JavaScript project
import { findPort, calibrate, teleoperate } from "@lerobot/node";
```

### CLI (Python lerobot compatible)

```bash
# Install globally
npm install -g lerobot

# Use identical commands to Python lerobot
lerobot find-port
lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
```

## This Demo

This cyberpunk-themed demo showcases the complete lerobot.js web capabilities:

- **Real-time robot control** in the browser
- **Interactive calibration** with live position feedback
- **Teleoperation** with keyboard and visual controls
- **Device management** with automatic reconnection
- **Data visualization** including motor positions and ranges
- **Modern UI** with cyberpunk aesthetics and responsive design

## Hardware Requirements

- **Chromium 89+** browser (Chrome, Edge, Brave)
- **HTTPS or localhost** (Web Serial API requirement)
- **SO-100 robot arms** or compatible hardware
- **USB connection** to robot

## Development

### Running the Demo

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Project Structure

```
src/
├── components/          # React components
│   ├── calibration-view.tsx    # Interactive calibration
│   ├── teleoperation-view.tsx  # Robot control interface
│   ├── device-dashboard.tsx    # Hardware management
│   └── docs-section.tsx        # API documentation
├── lib/                # Utilities
└── types/              # TypeScript definitions
```

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
