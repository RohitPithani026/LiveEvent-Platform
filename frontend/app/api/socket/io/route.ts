import { NextResponse } from "next/server"

// This route is a placeholder for Socket.IO initialization
// The actual Socket.IO server runs on a separate microservice
// Socket connections are handled by the WebSocket microservice at NEXT_PUBLIC_WS_URL
export async function GET() {
    return NextResponse.json({ 
        message: "Socket.IO is handled by the WebSocket microservice",
        wsUrl: process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000"
    })
}
