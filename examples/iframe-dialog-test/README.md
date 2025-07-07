# Iframe Dialog Test

This example tests WebSerial + WebUSB dialog behavior in iframe vs standalone environments to replicate HuggingFace Spaces behavior.

## Purpose

Tests the user gesture consumption issue that occurs when WebSerial and WebUSB dialogs conflict in iframe contexts (like HuggingFace Spaces).

## Files

- `iframe-dialog-test.html` - Main test page with iframe controls
- `iframe-content.html` - Content loaded in iframe to simulate HuggingFace Spaces
- `iframe-dialog-test.ts` - TypeScript logic for testing dialog behavior

## Running

From the root directory:

```bash
pnpm example:iframe-test
```

Or from this directory:

```bash
pnpm dev
```

## Testing

1. Click "🔓 Permissive" to load iframe in permissive mode
2. In the iframe, click "Test Actual findPort Function"
3. Should demonstrate sequential dialog behavior working in iframe context

## Browser Requirements

- Chrome/Edge 89+ with WebSerial and WebUSB APIs
- HTTPS or localhost
- Real robot hardware for full testing
