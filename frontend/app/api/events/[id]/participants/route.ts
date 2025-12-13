import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await context.params;
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify the user is the host of this event
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { hostId: true },
        });

        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (event.hostId !== session.user.id && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden: Only the host can view participants" }, { status: 403 });
        }

        // Fetch participants with user information (excluding the host)
        const participants = await prisma.participant.findMany({
            where: {
                eventId: eventId,
                user: {
                    id: {
                        not: event.hostId, // Exclude the host
                    },
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                joinedAt: "desc",
            },
        });

        // Format participants for the frontend
        const formattedParticipants = participants.map((participant) => ({
            id: participant.id,
            userId: participant.user.id,
            name: participant.user.name,
            email: participant.user.email,
            image: participant.user.image,
            joined: participant.joinedAt.toLocaleTimeString(),
            joinedAt: participant.joinedAt.toISOString(),
            status: "active" as const, // You can add logic to determine if user is currently active
        }));

        return NextResponse.json({
            participants: formattedParticipants,
            count: formattedParticipants.length,
        });
    } catch (error) {
        console.error("Failed to fetch participants:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

