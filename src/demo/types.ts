export interface ConnectedRobot {
  port: SerialPort;
  name: string;
  isConnected: boolean;
  robotType?: "so100_follower" | "so100_leader";
  robotId?: string;
  serialNumber?: string; // Unique identifier from USB device
  usbMetadata?: {
    vendorId: string;
    productId: string;
    serialNumber: string;
    manufacturerName: string;
    productName: string;
    usbVersionMajor?: number;
    usbVersionMinor?: number;
    deviceClass?: number;
    deviceSubclass?: number;
    deviceProtocol?: number;
  };
}
