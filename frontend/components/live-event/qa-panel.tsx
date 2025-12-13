"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ThumbsUp } from "lucide-react"
import { useSocket } from "@/components/providers/socket-provider"
import { useToast } from "@/hooks/use-toast"

interface QAPanelProps {
    eventId: string
}

interface QAQuestion {
    id: string
    question: string
    user: {
        id: string
        name: string
    }
    approved: boolean
    votes?: number
    answered?: boolean
}

export function QAPanel({ eventId }: QAPanelProps) {
    const { socket } = useSocket()
    const { toast } = useToast()
    const [question, setQuestion] = useState("")
    const [questions, setQuestions] = useState<QAQuestion[]>([])

    const fetchQuestions = useCallback(async () => {
        try {
            const response = await fetch(`/api/events/${eventId}/questions`)
            if (response.ok) {
                const data = await response.json()
                // Filter approved questions and deduplicate by ID
                const approvedQuestionsMap = new Map<string, QAQuestion>();
                data.questions
                    .filter((q: unknown) => {
                        const question = q as { approved?: boolean };
                        return question.approved;
                    })
                    .forEach((q: unknown) => {
                        const question = q as { 
                            id: string; 
                            question: string; 
                            user: { id: string; name: string }; 
                            approved: boolean;
                        };
                        if (!approvedQuestionsMap.has(question.id)) {
                            approvedQuestionsMap.set(question.id, {
                                id: question.id,
                                question: question.question,
                                user: {
                                    id: question.user.id,
                                    name: question.user.name,
                                },
                                approved: question.approved,
                            });
                        }
                    });
                setQuestions(Array.from(approvedQuestionsMap.values()))
            }
        } catch (error) {
            console.error("Failed to fetch questions:", error)
        }
    }, [eventId])

    // Fetch approved questions from database on mount
    useEffect(() => {
        fetchQuestions()
    }, [fetchQuestions])

    useEffect(() => {
        if (!socket) return

        const handleQuestionSubmitted = (data: QAQuestion) => {
            setQuestions((prev) => {
                // Avoid duplicates by ID
                if (prev.some(q => q.id === data.id)) {
                    return prev
                }
                // Only add if approved
                if (data.approved) {
                    return [data, ...prev]
                }
                return prev
            })
        }

        const handleQuestionApproved = (data: { id: string; approved: boolean }) => {
            setQuestions((prev) => {
                if (data.approved) {
                    // If approved and not already in list, fetch it
                    if (!prev.some(q => q.id === data.id)) {
                        fetchQuestions()
                    } else {
                        return prev.map((q) => (q.id === data.id ? { ...q, approved: data.approved } : q))
                    }
                } else {
                    // If unapproved, remove from list
                    return prev.filter(q => q.id !== data.id)
                }
                return prev
            })
        }

        socket.on("question-submitted", handleQuestionSubmitted)
        socket.on("question-approved", handleQuestionApproved)

        return () => {
            socket.off("question-submitted", handleQuestionSubmitted)
            socket.off("question-approved", handleQuestionApproved)
        }
    }, [socket, fetchQuestions])

    const submitQuestion = async () => {
        if (!question.trim()) {
            toast({
                title: "Invalid Question",
                description: "Please enter a question.",
                variant: "destructive",
            })
            return
        }

        try {
            // Submit question via API
            const response = await fetch(`/api/events/${eventId}/questions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    question: question.trim(),
                }),
            })

            if (response.ok) {
                const data = await response.json()
                
                // Also emit via socket for real-time updates
                if (socket) {
                    socket.emit("question-submitted", {
                        eventId,
                        question: question.trim(),
                    })
                }

                toast({
                    title: "Question Submitted",
                    description: data.message || "Your question has been submitted and is pending approval.",
                })

                setQuestion("")

                // Refresh questions list
                await fetchQuestions()
            } else {
                const errorData = await response.json()
                toast({
                    title: "Failed to submit question",
                    description: errorData.error || "Please try again.",
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Failed to submit question:", error)
            toast({
                title: "Error",
                description: "Failed to submit question. Please try again.",
                variant: "destructive",
            })
        }
    }

    const approvedQuestions = questions.filter((q) => q.approved)

    return (
        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold mb-4">Q&A Session</h3>

            <div className="space-y-4">
                <div className="flex space-x-2">
                    <Input
                        placeholder="Ask your question here..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                submitQuestion()
                            }
                        }}
                        className="flex-1"
                    />
                    <Button onClick={submitQuestion} disabled={!question.trim()}>
                        Submit
                    </Button>
                </div>

                <ScrollArea className="h-48">
                    <div className="space-y-3">
                        {approvedQuestions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No questions yet. Be the first to ask!</p>
                            </div>
                        ) : (
                            approvedQuestions.map((q) => (
                            <div key={q.id} className="p-3 bg-background rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{q.question}</p>
                                        <p className="text-xs text-muted-foreground">
                                            by {q.user?.name || "Anonymous"}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {q.votes !== undefined && (
                                            <Button variant="ghost" size="sm">
                                                <ThumbsUp className="w-3 h-3 mr-1" />
                                                {q.votes}
                                            </Button>
                                        )}
                                        {q.answered && <Badge variant="secondary">Answered</Badge>}
                                    </div>
                                </div>
                            </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
