# Vercel Web Bluetooth Frontend

This page communicates directly with the BeagleY-AI using Web Bluetooth.

There is:

- no backend
- no WebSocket
- no HTTP connection to the BeagleY-AI
- no measurement data sent to Vercel

The browser talks directly to the BLE peripheral.

## Local testing

Serve the directory over HTTPS or use a localhost development server.

Example:

```bash
python3 -m http.server 8000
```

For Web Bluetooth on Android Chrome, use a deployed HTTPS origin for normal testing.

## Deploy

Upload this directory to a Vercel project.

The browser requests the custom BLE service:

`7b7b0001-8f7b-4e7b-9b7b-123456789001`
