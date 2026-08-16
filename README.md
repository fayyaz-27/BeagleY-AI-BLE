# Hand Physiotherapy &mdash; Web Bluetooth Frontend

A static HTML/CSS/JS page that connects **directly** to a BeagleY-AI over
Bluetooth Low Energy using the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).
There is no backend, no build step, and no server-side code of any kind &mdash;
this is deployed as a plain static site.

## Files

| File          | Purpose                                              |
|---------------|-------------------------------------------------------|
| `index.html`  | Page structure: status indicator, Connect/Reset buttons, 4 metric tiles |
| `style.css`   | Responsive, mobile-friendly styling                   |
| `app.js`      | All Web Bluetooth logic (connect, notify, reset, error handling) |
| `vercel.json` | Minimal static-site config (clean URLs, a security header) |

No `package.json` is included &mdash; there's nothing to install or build.
Vercel serves static `.html`/`.css`/`.js` files as-is.

## Why no backend?

The BeagleY-AI is the only other party in this system, and it talks BLE, not
HTTP. Web Bluetooth lets the browser open a GATT connection straight to the
board, so Vercel's only job is serving these three static files over HTTPS
(required by the Web Bluetooth API).

## Deploying to Vercel

1. Install the Vercel CLI (or use the Vercel dashboard's "Import Project"
   flow with this folder / a Git repo containing it):
   ```bash
   npm install -g vercel
   ```
2. From inside this `vercel-web/` folder:
   ```bash
   vercel
   ```
   Follow the prompts (link/create a project, accept the defaults &mdash; no
   build command, no output directory override needed since it's a static
   site with `index.html` at the root).
3. For production deployment:
   ```bash
   vercel --prod
   ```
4. Vercel will print an HTTPS URL like `https://your-project.vercel.app`.
   Open it on a laptop or Android phone in Chrome or Edge.

Alternatively, push this folder to a Git repository and import it in the
Vercel dashboard (vercel.com &rarr; Add New Project) &mdash; every push
redeploys automatically. No environment variables or extra configuration
are required.

## Browser requirements

Web Bluetooth currently works in:
- Chrome / Edge / Opera on desktop (Windows, macOS, Linux, ChromeOS)
- Chrome on Android

It does **not** work in Safari or Firefox (no Web Bluetooth support), or in
any mobile browser on iOS (Apple has not implemented Web Bluetooth in
WebKit). The page must be served over **HTTPS** &mdash; Vercel gives you
this automatically.

## Testing without hardware

You can sanity-check the UI logic in the browser console even before the
BeagleY-AI side is running:

```js
// Fake a 16-byte little-endian measurement packet and feed it through
// the same decode path the real notification handler uses.
const buf = new ArrayBuffer(16);
const dv = new DataView(buf);
dv.setFloat32(0, 82.35, true);  // elbow_standing
dv.setFloat32(4, 45.10, true);  // elbow_laying
dv.setFloat32(8, 12.00, true);  // forearm_tilt
dv.setFloat32(12, 70.25, true); // final_rom
onMeasurementNotification({ target: { value: dv } });
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Web Bluetooth isn't available" | Wrong browser (use Chrome/Edge) or page not served over HTTPS |
| Chooser opens but no device listed | BeagleY-AI isn't advertising, or is out of range, or another client already holds the GATT connection |
| Connects, then immediately "Bluetooth disconnected" | BeagleY-AI app crashed or lost power right after connecting &mdash; check its logs |
| "Service not found" | Wrong UUID compiled into the BeagleY-AI firmware, or old firmware still running |
| Values never update | `startNotifications()` may have thrown silently &mdash; check the browser console; also confirm the BeagleY-AI is actually publishing (see beagley-ai README Test 4) |
| Reset button does nothing | You're disconnected (button is disabled while disconnected by design) |
