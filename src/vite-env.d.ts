/// <reference types="vite/client" />

// WebUSB API type declarations
interface USBDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  manufacturerName?: string;
  productName?: string;
  usbVersionMajor: number;
  usbVersionMinor: number;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

interface Navigator {
  usb: USB;
}
