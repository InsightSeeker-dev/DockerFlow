module.exports = {
  apps: [{
    name: "dockerflow",
    script: "npm",
    args: "start",
    cwd: "/root/DockerFlow",
    env: {
      NODE_ENV: "production",
      PORT: "3000"
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G"
  }]
}