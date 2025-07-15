import { vi } from "vitest";

// Mock Web Serial API
const mockSerialPort = {
  readable: new ReadableStream(),
  writable: new WritableStream(),
  close: vi.fn(),
  forget: vi.fn(),
  getInfo: vi.fn(() => ({ usbVendorId: 0x1234, usbProductId: 0x5678 })),
};

const mockSerial = {
  requestPort: vi.fn(() => Promise.resolve(mockSerialPort)),
  getPorts: vi.fn(() => Promise.resolve([mockSerialPort])),
};

// Mock WebUSB API
const mockUSB = {
  requestDevice: vi.fn(),
  getDevices: vi.fn(() => Promise.resolve([])),
};

// Attach to global navigator
Object.defineProperty(globalThis, "navigator", {
  value: {
    ...globalThis.navigator,
    serial: mockSerial,
    usb: mockUSB,
  },
});
