import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const where = userId ? { userId } : {};
    
    const images = await prisma.dockerImage.findMany({
      where,
      orderBy: { created: 'desc' },
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching docker images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch docker images' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { name, tag, size } = data;

    const image = await prisma.dockerImage.create({
      data: {
        name,
        tag,
        size,
        userId: session.user.id,
      },
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error creating docker image:', error);
    return NextResponse.json(
      { error: 'Failed to create docker image' },
      { status: 500 }
    );
  }
}
