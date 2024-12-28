import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { validateAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession();
    await validateAdmin(session);

    const rule = await prisma.alertRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch alert rule' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession();
    await validateAdmin(session);

    const data = await request.json();
    const rule = await prisma.alertRule.update({
      where: { id: params.ruleId },
      data,
    });

    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update alert rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession();
    await validateAdmin(session);

    await prisma.alertRule.delete({
      where: { id: params.ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete alert rule' },
      { status: 500 }
    );
  }
}
