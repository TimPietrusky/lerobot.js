## install lerobot

- clone the repo: git clone https://github.com/huggingface/lerobot.git
- go into the dir: cd lerobot
- setup venv with your favorite tool, i use uv: uv venv --python 3.10
- activate venv: windows: .venv\Scripts\activate
- install dependencies: uv pip install -e ".[feetech]"
  (we install feetech here as that is needed to talk with the motors that the so100 is using)

## identify USB ports

- connect usb / power
- run `python lerobot/find_port.py`

```
python lerobot/find_port.py
Finding all available ports for the MotorsBus.
Ports before disconnecting: ['COM3', 'COM4']
Remove the USB cable from your MotorsBus and press Enter when done.

The port of this MotorsBus is 'COM3'
Reconnect the USB cable.
```

- the port it will show you is the one from the disconnected arm
- in my case on windows the follower arm is COM4 and the leader arm is COM3 (but this could change, as the port mappings on windows are not fixed)

## check motor ids

**Important: Always do this first!** This checks if your robot motors are already configured correctly. If they are, you can skip the tedious setup process entirely.

**What are motor IDs?** Each motor needs a unique ID number (1, 2, 3, 4, 5, 6) so the computer can talk to them individually. Brand new motors usually all have the same default ID (1), which doesn't work.

### check follower arm

```
python -m lerobot.setup_motors --robot.port=COM4 --robot.type=so100_follower
```

### check leader arm

```
python -m lerobot.setup_motors --teleop.port=COM3 --robot.type=so100_leader
```

**If you see this - you're lucky! Skip to calibration:**

```
🎉 PERFECT! This arm is correctly configured:
   ✅ All 6 motors found: [1, 2, 3, 4, 5, 6]
   ✅ Correct baudrate: 1000000

✅ This arm is ready for calibration!
```

**If you see this - continue to "setup motors" below:**

```
⚠️  This arm needs motor ID setup:
   Expected IDs: [1, 2, 3, 4, 5, 6]
   Found IDs: [1, 1, 1, 1, 1, 1]
   Duplicate IDs: [1] (likely all motors have ID=1)
```

## setup motors

**⚠️ Only do this section if the motor check above showed your motors need setup!**

This is a one-time process where you connect each motor individually to assign unique ID numbers. It's tedious but only needed once - the ID gets permanently stored in each motor's memory.

**Why is this needed?** Motors come from the factory with the same default ID (usually 1). The computer can't tell them apart, so we need to give each motor a unique number.

**⚠️ Important safety notes:**

- Always power down (unplug power + USB) when connecting/disconnecting motors
- Connect only ONE motor at a time during this process
- The motor gears should be removed from the leader arm before this step

### follower arm

```
python -m lerobot.setup_motors --robot.type=so100_follower --robot.port=COM4
```

The script will guide you through connecting each motor one by one. Follow the prompts carefully.

### leader arm

```
python -m lerobot.setup_motors --teleop.type=so100_leader --teleop.port=COM3
```

Same process as the follower arm.

**After setup:** Run the motor check commands again to verify everything worked correctly. You should now see the "PERFECT!" message.

## calibrate

**What is calibration?** This teaches both robot arms to have the same understanding of joint positions. When both arms are in the same physical pose, they should report the same position values. This is crucial for the leader arm to properly control the follower arm.

**Why is this needed?** Even though the arms are identical, small manufacturing differences mean their position sensors might read slightly different values for the same physical position. Calibration fixes this.

**Important:** Make sure both arms have all motors properly connected (daisy-chained) before calibrating. The motor setup process has you disconnect motors individually, but for calibration you need the full arm assembled.

> **💡 Don't be intimidated by calibration!**
>
> **It's really simple:** You just manually move each joint to the correct position - no special technique required! The calibration process is just:
>
> 1. Start from the neutral position (standard in robotics)
> 2. Manually move each motor/joint to where it needs to be
> 3. Move them one at a time at whatever pace feels comfortable
> 4. The robot learns from the positions you set
>
> **That's it!** You're just physically positioning the joints - the software handles all the complex stuff automatically.

### calibrate follower arm

**Step 1:** Start the calibration script:

```
python -m lerobot.calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm
```

**Step 2:** Follow the script's prompts:

1. The script will ask you to **move the arm to the middle position**. This should be a **neutral pose** where:

   - **Shoulder pan (base, joint 1):** 0° - Point the arm straight forward along the +X axis (not twisted left or right)
   - **Shoulder lift (joint 2):** ~45° - Lift the upper arm segment upward at roughly 45 degrees from horizontal
   - **Elbow (joint 3):** ~90° - Bend the elbow to form an "L" shape, with the forearm perpendicular to the upper arm
   - **Wrist flex (joint 4):** 0° - Keep the wrist straight, aligned with the forearm
   - **Wrist roll (joint 5):** 0° - Keep the gripper pointing straight (not twisted around the forearm axis)
   - **Gripper (joint 6):** Fully closed position (mechanical hard stop)

   **Technical reference:** This is similar to a "home position" or "zero configuration" used in robot calibration - a repeatable, neutral pose that avoids joint limits and singularities. The arm should form clear geometric references (forward direction, L-shaped elbow) that are easy to reproduce.

   **💡 Tip:** Once you get the arm in the correct position, consider taking a photo for future reference!

2. The script will ask you to **move joints through their full range** - gently move each joint from its furthest position in one direction to its furthest position in the other direction (the joint will stop when it hits its physical limit). Do this for all joints while the script records, then press Enter when done
3. The script will **save the calibration automatically**

### calibrate leader arm

**Step 1:** Start the calibration script:

```
python -m lerobot.calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm
```

**Step 2:** Follow the script's prompts:

1. The script will ask you to **move the arm to the middle position**. This should be a **neutral pose** where:

   - **Shoulder pan (base, joint 1):** 0° - Point the arm straight forward along the +X axis (not twisted left or right)
   - **Shoulder lift (joint 2):** ~45° - Lift the upper arm segment upward at roughly 45 degrees from horizontal
   - **Elbow (joint 3):** ~90° - Bend the elbow to form an "L" shape, with the forearm perpendicular to the upper arm
   - **Wrist flex (joint 4):** 0° - Keep the wrist straight, aligned with the forearm
   - **Wrist roll (joint 5):** 0° - Keep the gripper pointing straight (not twisted around the forearm axis)
   - **Gripper (joint 6):** Fully closed position (mechanical hard stop)

   **Technical reference:** This is similar to a "home position" or "zero configuration" used in robot calibration - a repeatable, neutral pose that avoids joint limits and singularities.

2. The script will ask you to **move joints through their full range** - gently move each joint from its furthest position in one direction to its furthest position in the other direction (the joint will stop when it hits its physical limit). Do this for all joints while the script records, then press Enter when done
3. The script will **save the calibration automatically**

**✅ After both arms are calibrated, you're ready for teleoperation!**

## test teleoperation

Now test that your leader arm can control the follower arm:

```bash
python -m lerobot.teleoperate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm
```

**What should happen:**

- Both arms should connect automatically
- When you move the leader arm (manually), the follower arm should copy the movements
- Press `Ctrl+C` to stop teleoperation

**If something goes wrong:**

- Check your COM ports are correct
- Make sure both arms are powered on
- Verify the cables are properly connected

## record demonstrations (optional)

Once teleoperation works, you can record demonstrations for training a robot learning policy.

**For example, to record 10 episodes of a simple task:**

```bash
python -m lerobot.record --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm --dataset-name=my_first_dataset --num-episodes=10 --task="Pick up the red block and place it in the box"
```

**What this does:**

- Records your demonstrations using teleoperation
- Saves data to train a neural network later
- Each "episode" is one complete demonstration of the task

## next steps

✅ **You now have working SO-100 robot arms!**

**To continue with robot learning:**

- Follow the [Getting Started with Real-World Robots](https://huggingface.co/docs/lerobot/getting_started_real_world_robot) tutorial
- Learn how to train policies and run them autonomously
- Join the [Discord community](https://discord.com/invite/s3KuuzsPFb) for help and discussions

**Common next steps:**

1. **Add cameras** for vision-based tasks
2. **Record more complex demonstrations**
3. **Train neural network policies**
4. **Run policies autonomously**
