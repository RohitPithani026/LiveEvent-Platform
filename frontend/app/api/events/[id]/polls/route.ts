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

        const userId = session.user.id;

        // Fetch active poll for this event
        const poll = await prisma.poll.findFirst({
            where: {
                eventId: eventId,
                isActive: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                userResponses: {
                    where: {
                        userId: userId,
                    },
                },
            },
        });

        if (!poll) {
            return NextResponse.json({ poll: null, hasVoted: false });
        }

        // Check if user has already voted
        const hasVoted = poll.userResponses.length > 0;
        const userVote = hasVoted ? poll.userResponses[0].optionId : null;

        // Get all responses and count votes per option
        const allResponses = await prisma.pollResponse.findMany({
            where: {
                pollId: poll.id,
            },
        });

        // Count votes per option
        const responses: Record<string, number> = {};
        poll.options.forEach((_, index) => {
            responses[index.toString()] = allResponses.filter(r => r.optionId === index).length;
        });

        return NextResponse.json({
            poll: {
                id: poll.id,
                question: poll.question,
                options: poll.options,
                responses: responses,
                isActive: poll.isActive,
            },
            hasVoted,
            userVote,
        });
    } catch (error) {
        console.error("Failed to fetch poll:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await context.params;
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();
        const { pollId, optionId } = body;

        if (!pollId || optionId === undefined) {
            return NextResponse.json({ error: "Missing pollId or optionId" }, { status: 400 });
        }

        // Verify poll exists and is active
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
        });

        if (!poll || poll.eventId !== eventId) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        if (!poll.isActive) {
            return NextResponse.json({ error: "Poll is not active" }, { status: 400 });
        }

        // Check if user has already voted
        const existingResponse = await prisma.pollResponse.findUnique({
            where: {
                userId_pollId: {
                    userId: userId,
                    pollId: pollId,
                },
            },
        });

        if (existingResponse) {
            return NextResponse.json({ error: "You have already voted on this poll" }, { status: 400 });
        }

        // Validate optionId is within range
        if (optionId < 0 || optionId >= poll.options.length) {
            return NextResponse.json({ error: "Invalid option" }, { status: 400 });
        }

        // Create poll response
        await prisma.pollResponse.create({
            data: {
                userId: userId,
                pollId: pollId,
                eventId: eventId,
                optionId: optionId,
            },
        });

        // Update poll responses count in JSON (for backward compatibility)
        const allResponses = await prisma.pollResponse.findMany({
            where: { pollId: pollId },
        });

        const responses: Record<string, number> = {};
        poll.options.forEach((_, index) => {
            responses[index.toString()] = allResponses.filter(r => r.optionId === index).length;
        });

        await prisma.poll.update({
            where: { id: pollId },
            data: {
                responses: responses,
            },
        });

        return NextResponse.json({ 
            success: true,
            message: "Vote submitted successfully",
        });
    } catch (error) {
        console.error("Failed to submit poll vote:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

