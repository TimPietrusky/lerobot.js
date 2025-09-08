# User Story: Validate ACT Inference with LeRobot (Python) on Real Robot

## Summary

As the maintainer of **LeRobot.js**, I want to **prove that an ACT policy controls my robot end‑to‑end using LeRobot (Python)** before I invest in the ONNX Runtime Web port. This experiment must run a well‑documented ACT checkpoint, drive the robot in a simple task, and capture latency/fps so we know the approach is viable.

## Goals

- Use a **well‑documented ACT checkpoint** (ALOHA Transfer‑Cube) as the baseline.
- Run **LeRobot’s policy server + robot client** for ACT inference on my robot.
- Achieve **stable control at ≥ 15 fps** with safe motions.
- Record **metrics (fps, latency)** and a short **video**.

## Non‑Goals

- No training or data collection.
- No browser/ONNX work yet.
- No multi‑robot orchestration.

## Environment & Dependencies

- Python environment managed with `uv`
- Packages (minimum):
  - `lerobot` (from GitHub/Hub per official install instructions)
  - `torch`, `torchvision` (matching CUDA/CPU build)
  - `opencv-python`, `pyserial`, `numpy`, `tqdm`, `pyyaml`
- Hardware:
  - **SO‑100** robot (or your target robot) connected via USB
  - External camera (USB/webcam) aimed at the workspace

## Acceptance Criteria

1. **Model loads** in the policy server without errors.
2. **Robot client connects** and streams observations to the server.
3. **Inference loop runs ≥ 15 fps**, reporting average **model latency < 60 ms** and **end‑to‑end loop < 100 ms** on a laptop.
4. The robot performs **smooth, safe motions** for at least **30 seconds** without stalls.
5. Metrics (`metrics.json`) and a **short video** (10–20 s) are produced and saved in the experiment folder.
6. If the robot is disconnected, the system **falls back to simulation** without crashing.

## Experiment Folder Layout

```
experiments/act-inference-python/
  scripts/
    setup_env.sh
    start_policy_server.sh
    start_robot_client.sh
  configs/
    policy_server.yaml        # model path, host/port, normalization, chunk size
    robot_client.yaml         # robot type/port, camera device, fps target
  logs/
    policy_server.log
    robot_client.log
  artifacts/
    metrics.json
    demo.mp4
  README.md
```

## Procedure

### 1) Setup

- Create and activate environment with uv:
  ```bash
  uv venv act-py --python 3.10
  source act-py/bin/activate  # On Windows: act-py\Scripts\activate
  uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121  # or cpu wheels
  uv pip install opencv-python pyserial numpy tqdm pyyaml
  # Install LeRobot (per upstream instructions)
  uv pip install "git+https://github.com/huggingface/lerobot.git"
  ```
- Verify camera and serial access:
  ```bash
  python - << 'PY'
  import cv2, serial.tools.list_ports; print("cams ok?", cv2.getBuildInformation() is not None)
  print("serial ports:", [p.device for p in serial.tools.list_ports.comports()])
  PY
  ```

### 2) Calibrate robot

- Use the LeRobot calibration utility for your robot (SO‑100 or your target) and **save calibration data**.
- Confirm you can **tele‑operate** the robot (keyboard/joystick) for a quick smoke test.

### 3) Test basic robot control first

- Calibrate the robot using LeRobot Python:

  ```bash
  python -m lerobot.calibrate \
    --robot.type=so100_follower \
    --robot.port=/dev/ttyACM0  # or your actual port
  ```

- Test teleoperation to ensure robot works:
  ```bash
  python -m lerobot.teleoperate \
    --robot.type=so100_follower \
    --robot.port=/dev/ttyACM0 \
    --teleop.type=keyboard  # or gamepad if available
  ```

### 4) Run ACT policy evaluation

- Use the LeRobot evaluation script with an ACT model:
  ```bash
  python -m lerobot.scripts.eval \
    --policy.path=lerobot/act_aloha_sim_transfer_cube_human \
    --env.type=aloha_sim_transfer_cube \
    --eval.batch_size=1 \
    --eval.n_episodes=5 \
    --device=cuda  # or cpu
  ```
- For real robot evaluation (if supported):
  ```bash
  python -m lerobot.scripts.eval \
    --policy.path=lerobot/act_aloha_sim_transfer_cube_human \
    --env.type=real_world \
    --robot.type=so100_follower \
    --robot.port=/dev/ttyACM0 \
    --eval.batch_size=1 \
    --eval.n_episodes=3 \
    --device=cuda
  ```

### 5) Create custom inference script

- Create a simplified inference script based on the evaluation example:

  ```python
  # custom_act_inference.py - simplified version for testing
  import torch
  from lerobot.common.policies.factory import make_policy

  # Load policy
  policy = make_policy(policy_path="lerobot/act_aloha_sim_transfer_cube_human")
  policy.eval()

  # Run inference loop with robot
  # ... (see examples/2_evaluate_pretrained_policy.py)
  ```

### 6) Observe & record

- Record a **10–20 s video** of the behavior (screen + robot) and save to `artifacts/demo.mp4`.
- Collect metrics from the evaluation output (LeRobot eval script provides detailed metrics).
- Check the generated `eval_info.json` for performance data.

### 7) Tuning if needed

- If fps < 15:
  - Reduce image size (e.g., 224×224), drop sequence horizon.
  - Lower camera fps (e.g., 30 → 20).
  - Ensure USB bandwidth is not saturated.
- If motions are jerky:
  - Smooth actions (EMA) in client; clamp deltas per step.
  - Verify calibration and units match the policy’s action space.

### 8) Exit & cleanup

- Stop any running processes; ensure robot is safely positioned and torque is disabled.

## Deliverables

- `artifacts/eval_info.json` with evaluation metrics from LeRobot
- `artifacts/demo.mp4` short clip of robot behavior
- `artifacts/RESULTS.md` summary of findings and next steps for LeRobot.js

## Risks & Fallbacks

- **I/O schema mismatch** (obs/action names or shapes): add a small adapter layer in client to map to the policy’s expected schema.
- **Camera latency**: prefer MJPEG or raw; set fixed resolution; check exposure.
- **Serial jitter**: set consistent baud rate; use non‑blocking writes; cap action deltas.
- **Model not compatible with robot**: switch to a simpler behavior checkpoint or run in simulation to validate the server–client link first.

## Definition of Done

- The ACT checkpoint controls the robot (or the simulator) via LeRobot Python with stable fps and safe motion, producing metrics and a demo video. This de‑risks the next step: **export to ONNX and port to ORT Web**.
