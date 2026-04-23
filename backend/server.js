const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);
const instance = process.env.INSTANCE_NAME || "backend";
const role = process.env.INSTANCE_ROLE || "primary";
const startedAt = new Date().toISOString();
let requestCount = 0;

function buildPayload(req) {
  requestCount += 1;

  return {
    message: "Response from backend server",
    instance,
    role,
    port,
    hostname: process.env.HOSTNAME || "localhost",
    requestCount,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    startedAt,
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    instance,
    role,
    port,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.json(buildPayload(req));
});

app.listen(port, () => {
  console.log(`Server ${instance} started on port ${port}`);
});
