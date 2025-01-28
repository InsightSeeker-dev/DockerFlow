module.exports = {
  apps: [{
    name: "dockerflow",
    script: "npm",
    args: "start",
    cwd: "/DockerFlow",
    env: {
      NODE_ENV: "production",
      PORT: "3000"
    },
    watch: false,
    instances: "max",  // Utilise le maximum de CPU disponibles
    exec_mode: "cluster",  // Mode cluster pour le load balancing
    autorestart: true,
    max_memory_restart: "1G",
    error_file: "logs/error.log",
    out_file: "logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 4000,
    // Monitoring
    monitor: true,
    min_uptime: "60s",
    max_memory_restart: "2G",
    // Metrics pour le dashboard
    metrics: {
      http: true,
      custom_metrics: [{
        id: 'requests/sec',
        type: 'meter',
        unit: 'req/s'
      }]
    }
  }]
}