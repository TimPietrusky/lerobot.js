# User Story 003: Interactive React Demo

## Story

**As a** potential lerobot.js user exploring the library capabilities  
**I want** an interactive web demo with a modern, polished UI  
**So that** I can easily test robot calibration features and understand the library's potential before integrating it into my own projects

## Background

While lerobot.js provides platform-agnostic robotics functionality, we need a compelling demo interface to showcase its web capabilities. The current development setup uses Vite with basic HTML/CSS, but lacks the polish needed to demonstrate professional robotics applications.

The Python lerobot ecosystem includes various visualization tools and demos. For lerobot.js, we need a modern web demo that:

1. Showcases the existing web calibration functionality from User Story 002
2. Provides an intuitive UI for robot setup and calibration
3. Demonstrates real-time robot interaction capabilities
4. Serves as a reference implementation for web integration

**Critical Requirement**: React, Tailwind, and shadcn/ui should be **development dependencies only** - the core lerobot library must remain framework-agnostic so users can integrate it with any frontend framework or vanilla JavaScript.

## Acceptance Criteria

### Core Demo Features

- [ ] **Robot Calibration Interface**: Modern UI for SO-100 follower/leader calibration
- [ ] **Port Selection**: Intuitive Web Serial API port selection with visual feedback
- [ ] **Calibration Progress**: Real-time progress indicators during calibration procedures
- [ ] **Configuration Display**: View and manage saved calibration configurations
- [ ] **Error Handling**: User-friendly error messages and recovery suggestions
- [ ] **Responsive Design**: Works on desktop, tablet, and mobile devices

### UI/UX Requirements

- [ ] **Modern Design**: Clean, professional interface using Tailwind 4 and shadcn/ui
- [ ] **Brand Consistency**: Consistent with Hugging Face design language
- [ ] **Accessibility**: WCAG 2.1 AA compliant interface
- [ ] **Dark/Light Mode**: Theme switching support
- [ ] **Loading States**: Smooth loading and transition animations
- [ ] **Visual Feedback**: Clear status indicators for connection, calibration, and errors

### Technical Requirements

- [ ] **Framework Isolation**: React used only for demo, core library remains framework-agnostic
- [ ] **Development Only**: React/Tailwind/shadcn as devDependencies, not regular dependencies
- [ ] **Vite Integration**: Seamless integration with existing Vite development setup
- [ ] **TypeScript**: Full type safety throughout React components
- [ ] **Build Separation**: Demo build separate from library build
- [ ] **Tree Shaking**: Demo dependencies excluded from library builds

### Library Integration

- [ ] **Web API Usage**: Demonstrates proper usage of lerobot web APIs
- [ ] **Error Boundaries**: Robust error handling that doesn't break the demo
- [ ] **Performance**: Smooth interaction without blocking the UI thread
- [ ] **Real Hardware**: Demo works with actual SO-100 hardware via Web Serial API

## Expected User Flow

### Development Experience

```bash
# Install demo dependencies (includes React, Tailwind, shadcn/ui as devDependencies)
$ pnpm install

# Start development server with React demo
$ pnpm run dev
# Opens modern React interface at http://localhost:5173
```

### Demo Interface Flow

1. **Landing Page**: Clean introduction to lerobot.js with call-to-action buttons
2. **Robot Setup**: Card-based interface for selecting robot type (SO-100 follower/leader)
3. **Port Connection**:
   - Click "Connect Robot" button
   - Browser shows Web Serial API port selection dialog
   - Visual feedback shows connection status
4. **Calibration Interface**:
   - Step-by-step calibration wizard
   - Progress indicators and instructions
   - Real-time motor position feedback (if applicable)
5. **Results Display**:
   - Success confirmation with visual feedback
   - Option to download configuration file
   - Suggestions for next steps

### Error Handling Flow

- **No Web Serial Support**: Clear message with browser compatibility info
- **Connection Failed**: Troubleshooting steps with visual aids
- **Calibration Errors**: Descriptive error messages with retry options
- **Permission Denied**: Guide user through browser permission setup

## Implementation Details

### Project Structure Changes

```
lerobot.js/
├── src/
│   ├── demo/                    # Demo-specific React components (new)
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── CalibrationWizard.tsx
│   │   │   ├── RobotCard.tsx
│   │   │   ├── ConnectionStatus.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Setup.tsx
│   │   │   └── Calibrate.tsx
│   │   ├── hooks/
│   │   │   ├── useRobotConnection.ts
│   │   │   └── useCalibration.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── lerobot/                 # Core library (unchanged)
│   │   ├── web/
│   │   └── node/
│   └── main.ts                  # Original Vite entry (unchanged)
├── index.html                   # Updated to load React demo
├── demo.html                    # New: Vanilla JS demo option
└── lib.html                     # New: Library-only demo
```

### Package.json Changes

```json
{
  "scripts": {
    "dev": "vite --mode demo", // Runs React demo
    "dev:vanilla": "vite --mode vanilla", // Runs vanilla demo
    "dev:lib": "vite --mode lib", // Library-only mode
    "build": "tsc && vite build --mode lib", // Library build (no React)
    "build:demo": "tsc && vite build --mode demo" // Demo build (with React)
  },
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/typography": "^0.5.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.400.0"
  }
}
```

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const baseConfig = {
    plugins: [typescript()],
    build: {
      lib: {
        entry: "src/main.ts",
        name: "LeRobot",
        fileName: "lerobot",
      },
    },
  };

  if (mode === "demo") {
    return {
      ...baseConfig,
      plugins: [...baseConfig.plugins, react()],
      css: {
        postcss: {
          plugins: [tailwindcss, autoprefixer],
        },
      },
      build: {
        // Demo-specific build configuration
        outDir: "dist/demo",
        rollupOptions: {
          input: {
            main: "index.html",
          },
        },
      },
    };
  }

  return baseConfig; // Library-only build
});
```

### Key Dependencies

#### Demo-Only Dependencies (devDependencies)

- **React 18**: Latest stable React with concurrent features
- **Tailwind CSS 4**: Latest Tailwind with modern CSS features
- **shadcn/ui**: High-quality React component library
- **Lucide React**: Modern icon library
- **class-variance-authority**: For component variant management
- **clsx + tailwind-merge**: For conditional class management

#### Build Tools

- **@vitejs/plugin-react**: React support for Vite
- **PostCSS**: CSS processing for Tailwind
- **Autoprefixer**: CSS vendor prefixing

### React Components Architecture

#### Core Demo Components

```typescript
// Demo-specific React hooks
function useRobotConnection() {
  // Wraps lerobot web APIs in React-friendly hooks
  // Manages connection state, error handling
}

function useCalibration() {
  // Wraps lerobot calibration APIs
  // Provides progress tracking, status updates
}

// Main calibration wizard component
function CalibrationWizard({ robotType }: { robotType: string }) {
  const { connect, disconnect, status } = useRobotConnection();
  const { calibrate, progress, error } = useCalibration();

  // Multi-step wizard UI using shadcn/ui components
}
```

#### shadcn/ui Integration

- **Button**: Primary actions (Connect, Calibrate, Retry)
- **Card**: Robot selection, status displays, results
- **Progress**: Calibration progress indicators
- **Alert**: Error messages and warnings
- **Badge**: Status indicators (Connected, Calibrating, Error)
- **Dialog**: Confirmation dialogs and detailed error information
- **Toast**: Success/error notifications

### Technical Considerations

#### Framework Isolation Strategy

1. **Separate Entry Points**: Demo uses React, library uses vanilla TypeScript
2. **Build Modes**: Vite modes for demo vs library builds
3. **Dependency Isolation**: React in devDependencies, excluded from library bundle
4. **Type Safety**: Shared types between demo and library, but no runtime dependencies

#### Tailwind 4 Integration

- **New CSS Engine**: Leverage Tailwind 4's improved performance
- **Container Queries**: Responsive components using container queries
- **Modern CSS**: CSS Grid, flexbox, custom properties integration
- **Optimization**: Automatic unused CSS elimination

#### Performance Considerations

- **Code Splitting**: Lazy load calibration components
- **Bundle Size**: Demo bundle separate from library bundle
- **Web Serial API**: Non-blocking serial communication
- **Error Boundaries**: Prevent component crashes from breaking entire demo

#### Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Contrast**: WCAG AA compliant color schemes
- **Focus Management**: Proper focus handling during async operations

## Testing Strategy

### Integration Testing

- **Library Integration**: Verify demo correctly uses lerobot APIs
- **Build Testing**: Ensure library builds don't include React
- **Browser Compatibility**: Test Web Serial API across supported browsers

## Definition of Done

- [ ] **Functional Demo**: Interactive React demo showcases robot calibration
- [ ] **Modern UI**: Professional interface using Tailwind 4 and shadcn/ui
- [ ] **Framework Isolation**: React isolated to demo only, library remains framework-agnostic
- [ ] **Build Separation**: Library builds exclude React dependencies
- [ ] **Browser Compatibility**: Works in Chrome, Edge, and other Chromium browsers
- [ ] **Responsive Design**: Works across desktop, tablet, and mobile devices
- [ ] **Accessibility**: WCAG 2.1 AA compliant interface
- [ ] **Error Handling**: Graceful error handling with user-friendly messages
- [ ] **Documentation**: Demo usage documented in README
- [ ] **Performance**: Smooth interactions, fast loading times
- [ ] **Type Safety**: Full TypeScript coverage for demo components
- [ ] **Real Hardware**: Successfully calibrates actual SO-100 hardware via Web Serial API
