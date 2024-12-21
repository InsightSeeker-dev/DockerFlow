import Docker from 'dockerode';

export async function getContainerStats(container: Docker.Container) {
  try {
    const stats = await container.stats({ stream: false });
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * 100;
    
    const memoryUsage = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
    
    return {
      cpu: parseFloat(cpuUsage.toFixed(2)),
      memory: parseFloat(memoryUsage.toFixed(2))
    };
  } catch (error) {
    console.error('Error getting container stats:', error);
    return { cpu: 0, memory: 0 };
  }
}

export function parsePortBindings(ports: string) {
  const portBindings: any = {};
  const exposedPorts: any = {};
  
  if (ports) {
    ports.split(',').forEach((port: string) => {
      const [hostPort, containerPort] = port.trim().split(':');
      portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
      exposedPorts[`${containerPort}/tcp`] = {};
    });
  }

  return { portBindings, exposedPorts };
}
