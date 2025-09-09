# User Story 009: Web Worker Architecture (Main-thread Safe Web Library)

## Story

**As a** user building robotics UIs that also render live camera previews and interactive controls
**I want** `@lerobot/web` to run heavy control/recording work off the main thread
**So that** my UI stays smooth (no flicker/jank) even when teleoperation and recording are active

## Background

The current browser implementation runs teleoperation control loops, dataset assembly, and export logic on the main thread. When activating keyboard teleoperation while previewing a camera stream, the preview can flicker due to main-thread contention. This is a UX blocker for real-world apps that combine live video, UI interactions, and hardware control.

A worker-based architecture lets us move CPU-intensive, frequent, or bursty work off the main thread. The main thread remains responsible for DOM, video rendering and user interactions. The library must preserve the existing API (`calibrate()`, `teleoperate()`, `record()`) while transparently using workers when available, and cleanly falling back to the current approach otherwise.

## Goals

- Identical public API to today’s `@lerobot/web` (no breaking changes)
- Main-thread safe by default: heavy or frequent work executes in a Web Worker
- Graceful fallback when workers or specific APIs aren’t available
- Type-safe, minimal-copy message protocol using Transferables when possible
- Strict library/demo separation: UI and storage remain in demos
- Maintain Python lerobot UX parity and behavior

## Non-Goals (for this story)

- Changing dataset formats or camera acquisition approach
- Rewriting Web Serial API usage into worker (browser support is limited in workers)
- Introducing new external dependencies

## Acceptance Criteria

- Smooth UI under load:
  - With at least one active camera preview and keyboard teleoperation at 60–120 Hz, the preview does not flicker and UI remains responsive at ~60 FPS
- API compatibility:
  - `calibrate()`, `teleoperate()`, `record()` signatures and return shapes are unchanged
  - Feature-detect workers; automatically use worker-backed runtime when available, otherwise use current main-thread runtime
- Clear separation of responsibilities:
  - Worker executes control loops, interpolation, dataset assembly, export packaging, and CPU-heavy transforms
  - Main thread owns DOM/UI and browser-only APIs that are unavailable in workers (e.g., Web Serial write calls)
- Type-safe protocol:
  - Strongly typed request/response messages with versioned `type` fields; Transferable payloads used for large data
- Reliability & fallback:
  - If the worker crashes or becomes unavailable, operations fail gracefully with descriptive errors and suggest retry
  - Fallback path (main-thread) is automatically used when worker creation fails
- Tests & docs:
  - Unit tests cover protocol routing and basic round-trips
  - Planning docs updated; README notes main-thread-safe architecture

## Architecture Overview

### Worker Boundaries

- Execute in Worker:
  - Control loop scheduling and target computation for teleoperation (keyboard/direct and future teleoperators)
  - Episode/frame buffering and interpolation (regularization) for recording
  - Dataset assembly (tables/metadata), packaging (ZIP writer), and background export streaming
  - Lightweight telemetry aggregation for UI
- Execute on Main Thread:
  - DOM, UI, and camera previews (`<video>` elements)
  - Web Serial API read/write bridge (if browser does not permit worker access)
  - MediaRecorder handling (browser-optimized implementation already off main CPU in many engines)

### Threading Model

- Main thread spawns one worker per “process” instance as needed:
  - TeleoperationProcess → TeleopWorker
  - RecordProcess → RecordWorker (can be shared or composed with teleop worker depending on lifecycle)
- The public process objects returned from `teleoperate()`/`record()` are proxies. Method calls post messages to the worker and return promises where appropriate.
- SerialBridge (main-thread): worker requests motor write/read; main thread performs Web Serial operations and returns results. This preserves worker advantages while respecting browser API constraints.

### Message Protocol (Typed)

All messages include a discriminant `type` and a `requestId` when a response is expected.

- Teleoperation (examples):
  - `teleop/start`, `teleop/stop`
  - `teleop/update_key_state` { key, pressed }
  - `teleop/move_motor` { motorName, position }
  - `teleop/state_update` { motorConfigs, keyStates, lastUpdate } (worker → main)
  - `serial/write_position` { id, position } (worker → main) → `serial/ack`
- Recording (examples):
  - `record/start`, `record/stop`, `record/next_episode`
  - `record/frame_append` { payload transferable }
  - `record/export_zip` { options } → streaming progress events
- Error & lifecycle:
  - `worker/error`, `worker/ready`, `worker/teardown`

Use Transferables (ArrayBuffer/MessagePort) for large payloads to avoid copies.

### File Structure (web package)

```
packages/web/src/
├── workers/
│   ├── teleop.worker.ts             # Teleoperation control loop
│   ├── record.worker.ts             # Recording assembly/export
│   ├── protocol.ts                  # Message types & guards
│   └── utils.worker.ts              # Worker-side helpers (interpolation, zip)
├── bridges/
│   └── serial-bridge.ts             # Main-thread serial proxy for workers
├── teleoperate.ts                   # Spawns worker, returns proxy process
├── record.ts                        # Spawns worker, returns proxy process
└── types/
    └── worker.ts                    # Public worker-related types (narrow)
```

### Lifecycle & Fallback

- On `teleoperate()`/`record()` call:
  - Try to instantiate corresponding worker via `new Worker(new URL(...), { type: 'module' })`
  - If success: wire protocol channels and return proxy-backed process
  - If fail: fall back to current main-thread implementation (no behavioral changes)
- On `process.stop()` or page unload: send `worker/teardown` and terminate the worker

### Performance Notes

- Control loop cadence generated inside worker to avoid main-thread timers
- Batch serial commands from worker to main-thread bridge to minimize postMessage overhead
- Use coarse-to-fine update: high-rate calculations in worker; lower-rate UI state updates to main thread (e.g., 10–20 Hz) for rendering
- For export, stream chunks from worker; main thread triggers download or HF upload

### Error Handling

- All request/response messages enforce timeouts with descriptive errors
- Worker initialization guarded with feature detection and clear fallback
- Protocol version field enables future evolution without breaking older callers

## Phased Implementation Plan

### Phase 1: Dataset & Export Offload (Low Risk)

- Move episode interpolation, dataset assembly, and ZIP packaging to `record.worker.ts`
- Main thread keeps MediaRecorder and camera preview as-is
- Public API unchanged; verify ZIP download and HF upload via streamed messages

### Phase 2: Teleoperation Offload with SerialBridge

- Move control loop scheduling and target computation to `teleop.worker.ts`
- Implement SerialBridge on main thread for Web Serial commands
- Worker posts motor write requests; main thread executes and responds
- Throttle state updates to UI while maintaining high-rate control internally

### Phase 3: Fine-Grained Optimizations

- Introduce Transferables for large buffers
- Optional OffscreenCanvas pipelines for future video transforms (not required for current scope)
- Tune batching and message cadence under hardware testing

### Phase 4: Reliability & Observability

- Heartbeat messages and auto-restart policy for worker failures
- Dev diagnostics toggles; production minimal logging

## Risks & Mitigations

- Web Serial availability in workers: use main-thread SerialBridge (design accounts for this)
- Message overhead at high Hz: batch commands and reduce UI state update frequency
- Browser differences: feature-detect and test on Chromium, Firefox (where supported), Safari Technology Preview

## Definition of Done

- UI remains smooth with active camera preview and keyboard teleoperation; no flicker observed in manual tests
- Worker-backed runtime enabled by default when available; fallback path verified
- `calibrate()`, `teleoperate()`, `record()` maintain identical signatures and behavior
- Typed protocol implemented with Transferables where applicable
- Unit tests for protocol routing and error timeouts
- Documentation updated (this user story + README note)
