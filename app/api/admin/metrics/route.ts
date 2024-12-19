import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getSystemMetrics() {
  try {
    // CPU Usage
    const { stdout: cpuInfo } = await execAsync('wmic cpu get loadpercentage');
    const cpuUsage = parseFloat(cpuInfo.split('\n')[1]) || 0;

    // Memory Usage
    const { stdout: memInfo } = await execAsync('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value');
    const memLines = memInfo.split('\n');
    const totalMemory = parseInt(memLines[1].split('=')[1]);
    const freeMemory = parseInt(memLines[0].split('=')[1]);
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    // Disk Usage
    const { stdout: diskInfo } = await execAsync('wmic logicaldisk get size,freespace,caption');
    const diskLines = diskInfo.split('\n').filter(line => line.trim());
    let totalSpace = 0;
    let totalFree = 0;
    
    diskLines.slice(1).forEach(line => {
      const [caption, freeSpace, size] = line.trim().split(/\s+/);
      if (size && freeSpace) {
        totalSpace += parseInt(size);
        totalFree += parseInt(freeSpace);
      }
    });
    
    const diskUsage = ((totalSpace - totalFree) / totalSpace) * 100;

    // Network Usage (simplified)
    const { stdout: netInfo } = await execAsync('wmic NIC where "NetEnabled=\'true\'" get BytesReceivedPersec,BytesSentPersec');
    const netLines = netInfo.split('\n').filter(line => line.trim());
    let networkUsage = 0;
    
    netLines.slice(1).forEach(line => {
      const [received, sent] = line.trim().split(/\s+/).map(Number);
      if (!isNaN(received) && !isNaN(sent)) {
        networkUsage += received + sent;
      }
    });

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const metrics = await getSystemMetrics();
    
    return new NextResponse(JSON.stringify(metrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in metrics route:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
