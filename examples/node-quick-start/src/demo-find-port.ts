/**
 * Port Discovery Demo
 *
 * Demonstrates how to find and connect to robot hardware programmatically
 */

import { findPort, connectPort } from "@lerobot/node";
import type { RobotConnection, DiscoveredPort } from "@lerobot/node";

async function demoFindPort() {
  console.log("🔍 Port Discovery Demo");
  console.log("======================\n");

  try {
    // Demo 1: Basic port discovery
    console.log("📋 Demo 1: Basic robot discovery");
    console.log("Looking for connected robots...\n");

    const findProcess = await findPort({
      onMessage: (message) => console.log(`   📡 ${message}`),
    });
    const discoveredPorts = await findProcess.result;

    if (discoveredPorts.length === 0) {
      console.log("❌ No robots found.");
      console.log("\n🔧 Make sure your robot is:");
      console.log("   - Connected via USB");
      console.log("   - Powered on");
      console.log("   - Using a working USB cable");
      return;
    }

    console.log(`\n✅ Found ${discoveredPorts.length} robot port(s):`);
    discoveredPorts.forEach((port, index) => {
      console.log(`   ${index + 1}. ${port.robotType} on ${port.path}`);
      console.log(`      Port: ${port.path}`);
      console.log(`      Type: ${port.robotType}`);
    });

    // Demo 2: Connect to discovered robot
    console.log("\n🔌 Demo 2: Connecting to discovered robot");

    const robot = await connectPort(
      discoveredPorts[0].path,
      "so100_follower",
      "demo_robot"
    );

    console.log(
      `✅ Connected to robot: ${robot.robotType} (ID: ${robot.robotId})`
    );
    console.log(`   Port: ${robot.port.path}`);
    console.log(`   Connected: ${robot.isConnected ? "✅" : "❌"}`);
    console.log(`   Baudrate: ${robot.port.baudRate}`);

    // Demo 3: Connection details
    console.log("\n🔌 Demo 3: Connection details");
    console.log("Robot connection properties:");
    console.log(`   Name: ${robot.name}`);
    console.log(`   Type: ${robot.robotType}`);
    console.log(`   ID: ${robot.robotId}`);
    console.log(`   Port: ${robot.port.path}`);
    console.log(`   Serial: ${robot.serialNumber}`);
    console.log(`   Connected: ${robot.isConnected ? "✅" : "❌"}`);

    // Demo 4: Silent discovery (no progress messages)
    console.log("\n🤫 Demo 4: Silent discovery");
    console.log("Finding robots without progress messages...");

    const silentProcess = await findPort(); // No onMessage callback
    const silentRobots = await silentProcess.result;

    console.log(`Found ${silentRobots.length} robot(s) silently`);

    console.log("\n🎉 Port discovery demo completed!");
    console.log("\nℹ️  Note: For interactive port discovery, use the CLI:");
    console.log("   npx lerobot find-port");
  } catch (error) {
    console.error("\n❌ Port discovery failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("- Check USB connections");
    console.log("- Verify robot is powered on");
    console.log("- Try different USB ports/cables");
    console.log("- On Linux: Check serial port permissions");
    console.log("- For interactive port discovery, use: npx lerobot find-port");
    process.exit(1);
  }
}

demoFindPort();
