import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AlertType, AlertSeverity, UserRole } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const containerId = searchParams.get("containerId");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    const where: any = {
      userId: session.user.id,
    };

    if (containerId) {
      where.containerId = containerId;
    }

    if (startTime) {
      where.timestamp = {
        ...where.timestamp,
        gte: new Date(startTime),
      };
    }

    if (endTime) {
      where.timestamp = {
        ...where.timestamp,
        lte: new Date(endTime),
      };
    }

    const resourceUsage = await prisma.resourceUsage.findMany({
      where,
      include: {
        container: {
          select: {
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 100, // Limit results to prevent overwhelming response
    });

    return NextResponse.json(resourceUsage);
  } catch (error) {
    console.error("Error fetching resource usage:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { containerId, cpuUsage, memoryUsage, networkIO } = body;

    if (typeof cpuUsage !== "number" || typeof memoryUsage !== "number" || typeof networkIO !== "number") {
      return new NextResponse("Invalid resource usage data", { status: 400 });
    }

    // If containerId is provided, verify the container belongs to the user
    if (containerId) {
      const container = await prisma.container.findFirst({
        where: {
          id: containerId,
          userId: session.user.id,
        },
      });

      if (!container) {
        return new NextResponse("Container not found", { status: 404 });
      }
    }

    const resourceUsage = await prisma.resourceUsage.create({
      data: {
        userId: session.user.id,
        containerId,
        cpuUsage,
        memoryUsage,
        networkIO,
      },
      include: {
        container: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    // Check if any resource thresholds are exceeded
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        cpuThreshold: true,
        memoryThreshold: true,
      },
    });

    if (user) {
      const alerts = [];

      if (cpuUsage > user.cpuThreshold) {
        alerts.push({
          type: "CONTAINER",
          severity: "WARNING",
          title: "CPU Threshold Exceeded",
          message: `CPU usage (${cpuUsage}%) exceeds threshold (${user.cpuThreshold}%)`,
          source: containerId ? "container" : "system",
          containerId,
        });
      }

      if (memoryUsage > user.memoryThreshold) {
        alerts.push({
          type: "CONTAINER",
          severity: "WARNING",
          title: "Memory Threshold Exceeded",
          message: `Memory usage (${memoryUsage}%) exceeds threshold (${user.memoryThreshold}%)`,
          source: containerId ? "container" : "system",
          containerId,
        });
      }

      // Create alerts if thresholds are exceeded
      if (alerts.length > 0) {
        await prisma.alert.createMany({
          data: alerts.map(alert => ({
            userId: session.user.id,
            type: alert.type as AlertType,
            title: alert.title,
            message: alert.message,
            source: alert.source,
            severity: alert.severity as AlertSeverity,
            status: "PENDING",
          })),
        });
      }
    }

    return NextResponse.json(resourceUsage);
  } catch (error) {
    console.error("Error recording resource usage:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== UserRole.ADMIN) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const olderThan = searchParams.get("olderThan");

    if (!olderThan) {
      return new NextResponse("Missing olderThan parameter", { status: 400 });
    }

    const date = new Date(olderThan);
    if (isNaN(date.getTime())) {
      return new NextResponse("Invalid date format", { status: 400 });
    }

    // Delete old resource usage data
    await prisma.resourceUsage.deleteMany({
      where: {
        timestamp: {
          lt: date,
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting resource usage data:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
