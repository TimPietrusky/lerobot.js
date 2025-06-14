# User Story 001: Find USB Ports

## Story

**As a** robotics developer setting up SO-100 robot arms  
**I want** to identify which USB ports my robot arms are connected to  
**So that** I can configure my robot arms without manually testing each port

## Background

When setting up SO-100 robot arms (or any robotics hardware), users need to identify which USB/serial ports correspond to their robot controllers. The Python lerobot provides a `find_port.py` script that:

1. Lists all available serial ports
2. Asks the user to disconnect a specific device
3. Detects which port disappeared
4. Identifies that port as belonging to the disconnected device

We need to replicate this functionality in Node.js for lerobot.js.

## Acceptance Criteria

### Core Functionality

- [ ] **Port Discovery**: List all available serial/USB ports on the system
- [ ] **Interactive Detection**: Guide user through disconnect/reconnect process
- [ ] **Port Identification**: Detect which port corresponds to which robot arm
- [ ] **Cross-Platform**: Work on Windows, macOS, and Linux
- [ ] **CLI Interface**: Provide `npx lerobot find-port` command identical to Python version

### User Experience

- [ ] **Clear Instructions**: Provide step-by-step guidance to user
- [ ] **Error Handling**: Handle cases where no ports are found or detection fails
- [ ] **Progress Feedback**: Show current status during detection process
- [ ] **Results Display**: Clearly show which port belongs to which device

### Technical Requirements

- [ ] **Node.js Native**: Use Node.js serial port libraries (no Python dependencies)
- [ ] **TypeScript**: Fully typed implementation following our conventions
- [ ] **CLI Tool**: Executable via `npx lerobot find-port` (matching Python version)
- [ ] **snake_case**: File naming follows lerobot conventions

## Expected User Flow

```bash
$ npx lerobot find-port

Finding all available ports for the MotorsBus.
Ports before disconnecting: ['COM3', 'COM4']
Remove the USB cable from your MotorsBus and press Enter when done.

The port of this MotorsBus is 'COM3'
Reconnect the USB cable.
```

**For multiple arms, run separately:**

```bash
# First arm
$ npx lerobot find-port
# Follow prompts...

# Second arm
$ npx lerobot find-port
# Follow prompts...
```

## Implementation Details

### File Structure

```
src/lerobot/
└── find_port.ts                   # Direct port of Python script

src/cli/
└── index.ts                       # Main CLI entry point with find-port command
```

### Key Dependencies

- **serialport**: For cross-platform serial port detection and management
- **readline**: Node.js built-in for simple input() equivalent

### Core Functions to Implement

```typescript
// find_port.ts (matching Python naming)
async function findAvailablePorts(): Promise<string[]>;
async function findPort(): Promise<void>; // Main interactive function
```

### Technical Considerations

#### Cross-Platform Serial Ports

- **Windows**: COM ports (COM1, COM2, etc.)
- **macOS**: /dev/cu._ or /dev/tty._
- **Linux**: /dev/ttyUSB*, /dev/ttyACM*

#### Error Scenarios to Handle

- No serial ports detected
- Multiple ports disconnected simultaneously
- Port permissions issues
- User cancels detection process
- Same port reconnected to different device

#### Performance & UX

- Fast port scanning (< 1 second)
- Clear progress indicators
- Timeout handling for user input
- Graceful interrupt handling (Ctrl+C)

## Definition of Done

- [ ] **Functional**: Successfully identifies robot arm ports on Windows/macOS/Linux
- [ ] **Tested**: Unit tests for core logic, integration tests with mock serial ports
- [ ] **Documented**: README section explaining usage
- [ ] **CLI Ready**: Installable and runnable as CLI tool
- [ ] **Type Safe**: Full TypeScript coverage with strict mode
- [ ] **Follows Conventions**: snake_case files, proper architecture
