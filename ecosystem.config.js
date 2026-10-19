module.exports = {
  apps: [
    {
      name: "pemulung",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restart: 10,
      max_memory_restart: "300M",
      kill_timeout: 5000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
