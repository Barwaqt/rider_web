module.exports = {
  apps: [{
    name: "barwaqt-rider",
    cwd: "/var/www/rider.barwaqt.com",
    script: "node_modules/next/dist/bin/next",
    args: "start --hostname 127.0.0.1 --port 3003",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
  }],
};
