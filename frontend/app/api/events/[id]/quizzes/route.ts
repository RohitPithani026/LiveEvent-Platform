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

        // Fetch active quiz for this event
        const quiz = await prisma.quiz.findFirst({
            where: {
                eventId: eventId,
                isActive: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                responses: {
                    where: {
                        userId: userId,
                    },
                },
            },
        });

        if (!quiz) {
            return NextResponse.json({ quiz: null, hasSubmitted: false });
        }

        // Check if user has already submitted
        const hasSubmitted = quiz.responses.length > 0;
        const userResponse = hasSubmitted ? {
            optionId: quiz.responses[0].optionId,
            isCorrect: quiz.responses[0].isCorrect,
        } : null;

        return NextResponse.json({
            quiz: {
                id: quiz.id,
                question: quiz.question,
                options: quiz.options,
                correctAnswer: quiz.correctAnswer,
                timeLimit: quiz.timeLimit,
                isActive: quiz.isActive,
            },
            hasSubmitted,
            userResponse,
        });
    } catch (error) {
        console.error("Failed to fetch quiz:", error);
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
        const { quizId, optionId } = body;

        if (!quizId || optionId === undefined) {
            return NextResponse.json({ error: "Missing quizId or optionId" }, { status: 400 });
        }

        // Verify quiz exists and is active
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
        });

        if (!quiz || quiz.eventId !== eventId) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        if (!quiz.isActive) {
            return NextResponse.json({ error: "Quiz is not active" }, { status: 400 });
        }

        // Check if user has already submitted
        const existingResponse = await prisma.quizResponse.findUnique({
            where: {
                userId_quizId: {
                    userId: userId,
                    quizId: quizId,
                },
            },
        });

        if (existingResponse) {
            return NextResponse.json({ 
                error: "You have already submitted an answer for this quiz",
                isCorrect: existingResponse.isCorrect,
                correctAnswer: Number(quiz.correctAnswer),
                userAnswer: existingResponse.optionId,
            }, { status: 400 });
        }

        // Validate optionId is within range
        const optionIdNum = Number(optionId);
        if (isNaN(optionIdNum) || optionIdNum < 0 || optionIdNum >= quiz.options.length) {
            return NextResponse.json({ error: "Invalid option" }, { status: 400 });
        }

        // Check if answer is correct (ensure both are numbers for comparison)
        const correctAnswerNum = Number(quiz.correctAnswer);
        const isCorrect = optionIdNum === correctAnswerNum;
        
        // Debug logging (can be removed in production)
        console.log(`Quiz answer check: optionId=${optionIdNum}, correctAnswer=${correctAnswerNum}, isCorrect=${isCorrect}`);

        // Create quiz response
        await prisma.quizResponse.create({
            data: {
                userId: userId,
                quizId: quizId,
                eventId: eventId,
                optionId: optionIdNum,
                isCorrect: isCorrect,
            },
        });

        // Update user score if correct
        if (isCorrect) {
            const points = 100;
            const existingScore = await prisma.score.findUnique({
                where: {
                    userId_eventId: {
                        userId: userId,
                        eventId: eventId,
                    },
                },
            });

            if (existingScore) {
                await prisma.score.update({
                    where: { id: existingScore.id },
                    data: {
                        points: existingScore.points + points,
                    },
                });
            } else {
                await prisma.score.create({
                    data: {
                        userId: userId,
                        eventId: eventId,
                        points: points,
                    },
                });
            }
        }

        return NextResponse.json({ 
            success: true,
            isCorrect,
            correctAnswer: correctAnswerNum,
            message: isCorrect ? "Correct answer!" : "Incorrect answer",
        });
    } catch (error) {
        console.error("Failed to submit quiz answer:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

