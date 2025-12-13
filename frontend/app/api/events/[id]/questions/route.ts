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

        // Fetch Q&A questions for this event
        const questions = await prisma.qnA.findMany({
            where: {
                eventId: eventId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                id: "desc",
            },
        });

        // Check which questions the current user has submitted
        const userQuestionIds = questions
            .filter(q => q.userId === userId)
            .map(q => q.id);

        return NextResponse.json({ 
            questions,
            userQuestionIds,
        });
    } catch (error) {
        console.error("Failed to fetch questions:", error);
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
        const { question } = body;

        if (!question || typeof question !== "string" || question.trim().length === 0) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 });
        }

        // Create Q&A question
        const qnaQuestion = await prisma.qnA.create({
            data: {
                userId: userId,
                eventId: eventId,
                question: question.trim(),
                approved: false, // Questions need host approval
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ 
            success: true,
            question: {
                id: qnaQuestion.id,
                question: qnaQuestion.question,
                user: qnaQuestion.user,
                approved: qnaQuestion.approved,
            },
            message: "Question submitted successfully. Waiting for host approval.",
        });
    } catch (error) {
        console.error("Failed to submit question:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

