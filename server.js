// Custom entry point for hosts that run a Node.js app as a plain script
// rather than executing `next start` themselves (Hostinger's hPanel Node.js
// app manager is the one that needs this; Render runs `npm start` directly
// and never touches this file).
//
// Those hosts hand the app a port through the PORT environment variable and
// expect the process to bind it immediately. `next start` also reads PORT,
// but only once its own CLI has finished parsing arguments and booting —
// long enough that a host polling for the port to open concludes the app
// never started, kills it, and tries again. This binds the port directly,
// with nothing in front of it.
const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, "0.0.0.0", () => {
    console.log(`Ready on port ${port}`);
  });
});
