import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return NextResponse.json({
      cpu: cpuUsage,
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
      },
      disk: {
        total: 1000000000000, // Example values
        used: 400000000000,
        free: 600000000000,
      },
    });
  } catch (error) {
    console.error('System metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}