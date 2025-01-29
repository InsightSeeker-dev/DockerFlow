import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { suggestAlternativePort } from '@/lib/server/ports';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const port = searchParams.get('port');

    if (!port) {
      return NextResponse.json(
        { error: 'Port parameter is required' },
        { status: 400 }
      );
    }

    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber)) {
      return NextResponse.json(
        { error: 'Invalid port number' },
        { status: 400 }
      );
    }

    const availablePort = await suggestAlternativePort(portNumber);
    
    return NextResponse.json({ port: availablePort });
  } catch (error) {
    console.error('Error checking port:', error);
    return NextResponse.json(
      { error: 'Failed to check port availability' },
      { status: 500 }
    );
  }
}
