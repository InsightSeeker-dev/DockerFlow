import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for alert rule
const alertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["container", "system", "user"]),
  condition: z.object({}).passthrough(), // Flexible JSON structure for conditions
  action: z.object({}).passthrough(),    // Flexible JSON structure for actions
  enabled: z.boolean().default(true),
  severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");
    const enabled = searchParams.get("enabled");

    const where: any = {
      createdBy: session.user.id,
    };

    if (type) {
      where.type = type;
    }

    if (enabled !== null) {
      where.enabled = enabled === "true";
    }

    const rules = await prisma.alertRule.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching alert rules:", error);
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
    
    // Validate input
    const validatedData = alertRuleSchema.parse(body);

    const rule = await prisma.alertRule.create({
      data: {
        ...validatedData,
        createdBy: session.user.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.errors), { status: 400 });
    }
    console.error("Error creating alert rule:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new NextResponse("Missing rule ID", { status: 400 });
    }

    // Validate input
    const validatedData = alertRuleSchema.partial().parse(updateData);

    // Check if rule exists and belongs to user
    const existingRule = await prisma.alertRule.findFirst({
      where: {
        id,
        createdBy: session.user.id,
      },
    });

    if (!existingRule) {
      return new NextResponse("Alert rule not found", { status: 404 });
    }

    const rule = await prisma.alertRule.update({
      where: { id },
      data: validatedData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.errors), { status: 400 });
    }
    console.error("Error updating alert rule:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing rule ID", { status: 400 });
    }

    // Check if rule exists and belongs to user
    const existingRule = await prisma.alertRule.findFirst({
      where: {
        id,
        createdBy: session.user.id,
      },
    });

    if (!existingRule) {
      return new NextResponse("Alert rule not found", { status: 404 });
    }

    await prisma.alertRule.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting alert rule:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
