"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, Users, MessageCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePageTracking, useEngagementTracking } from "@/hooks/use-analytics"
import { AnalyticsWidget } from "@/components/analytics/analytics-widget"
import { WebRTCVideo } from "@/components/live-event/webrtc-video"
import { QuizEngine } from "@/components/live-event/quiz-engine"
import { LivePolls } from "@/components/live-event/live-polls"
import { QAPanel } from "@/components/live-event/qa-panel"
import { Leaderboard } from "@/components/live-event/leaderboard"
import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface Event {
    id: string
    title: string
    description: string
    startTime: string
    duration: number
    isLive: boolean
    bannerUrl?: string
    category: string
    visibility: string
    registrationRequired: boolean
    capacity: number
    rating: number
    host: {
        id: string
        name: string
        avatar?: string
        hostId: string
        rating: number
    }
    _count: {
        participants: number
    }
    interactiveFeatures: string[]
}

export default function LiveEventRoom() {
    const [message, setMessage] = useState("")
    const [currentUserScore, setCurrentUserScore] = useState(540)
    const [event, setEvent] = useState<Event | null>(null)
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const params = useParams()
    const { data: session } = useSession()
    const user = session?.user

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                setLoading(true);

                const response = await fetch(`/api/events/${params.eventId}`);

                if (response.ok) {
                    const data = await response.json();
                    setEvent(data.event);

                    console.log("Event fetched successfully.")
                } else {
                    console.log("Failed to load event.")
                }
            } catch (error) {
                console.error("Failed to fetch event:", error);
            } finally {
                setLoading(false);
            }
        };

        if (params.eventId) {
            fetchEvent();
        }
    }, [params.eventId]);

    usePageTracking("live_event_room", { eventId: "tech-summit-2024" })
    const { trackInteraction, trackEngagement } = useEngagementTracking("tech-summit-2024")

    const chatMessages = [
        { id: 1, user: "Alice", message: "Great presentation so far!", time: "2:34 PM" },
        { id: 2, user: "Bob", message: "When will the Q&A start?", time: "2:35 PM" },
        { id: 3, user: "Carol", message: "Love the interactive features!", time: "2:36 PM" },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900">

                <div className="container mx-auto px-4 py-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="mt-4 text-slate-400">Loading event...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-slate-900">

                <div className="container mx-auto px-4 py-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-4">Event Not Found</h1>
                        <p className="text-slate-400">The event you're looking for doesn't exist.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 px-2 py-1 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg"></div>
                            <span className="font-bold">EventFlow</span>
                        </div>
                        {/* <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            🔴 LIVE
                        </Badge> */}
                    </div>

                    {/* <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>1,247</span>
                        </div>
                        <ThemeToggle />
                        <Button variant="outline" size="sm">
                            Leave Event
                        </Button>
                    </div> */}
                </div>
            </header>

            <div className="container mx-auto px-4 py-4">
                <div className="grid lg:grid-cols-4 gap-6 h-[calc(75vh-120px)]">
                    {/* Main Video Area */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Video Player */}
                        <WebRTCVideo eventTitle={event.title} eventId="tech-summit-2024" />

                        {/* Interactive Panel */}
                        <Card className="rounded-2xl shadow-lg">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Interactive Session</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="quiz" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="quiz">Live Quiz</TabsTrigger>
                                        <TabsTrigger value="poll">Live Poll</TabsTrigger>
                                        <TabsTrigger value="qa">Q&A</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="quiz" className="space-y-4">
                                        <QuizEngine eventId="tech-summit-2024" onScoreUpdate={setCurrentUserScore} />
                                    </TabsContent>

                                    <TabsContent value="poll" className="space-y-4">
                                        <LivePolls eventId="tech-summit-2024" />
                                    </TabsContent>

                                    <TabsContent value="qa" className="space-y-4">
                                        <QAPanel eventId="tech-summit-2024" />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Chat */}
                        <Card className="rounded-2xl shadow-lg flex flex-col h-80">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center space-x-2">
                                        <MessageCircle className="w-5 h-5" />
                                        <span>Live Chat</span>
                                    </CardTitle>
                                    <Badge variant="secondary">1.2k</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col p-0">
                                <ScrollArea className="flex-1 px-4">
                                    <div className="space-y-3">
                                        {chatMessages.map((msg) => (
                                            <div key={msg.id} className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-medium text-sm">{msg.user}</span>
                                                    <span className="text-xs text-muted-foreground">{msg.time}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{msg.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="p-4 border-t">
                                    <div className="flex space-x-2">
                                        <Input
                                            placeholder="Type your message..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="sm"
                                            className="px-3"
                                            onClick={() => {
                                                if (message.trim()) {
                                                    trackInteraction("chat_message_sent", { message: message.trim() })
                                                    trackEngagement("chat_activity", { messageLength: message.length })
                                                    setMessage("")
                                                }
                                            }}
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Leaderboard */}
                        <Leaderboard eventId="tech-summit-2024" currentUserScore={currentUserScore} />
                    </div>
                </div>
            </div>

            <AnalyticsWidget />
        </div>
    )
}
