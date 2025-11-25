"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const grpc_client_1 = require("./grpc-client");
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "websocket-gateway" });
});
// Test endpoint to broadcast a message to a room
app.post("/test-broadcast", (req, res) => {
    const { eventId, message } = req.body;
    if (!eventId || !message) {
        return res.status(400).json({ error: "eventId and message required" });
    }
    io.to(eventId).emit("new-message", {
        id: `test-${Date.now()}`,
        content: message,
        user: {
            name: "Test User",
            role: "PARTICIPANT",
            id: "test-user",
        },
        timestamp: new Date().toISOString(),
    });
    res.json({ success: true, eventId });
});
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
    path: "/socket.io",
    transports: ["polling", "websocket"],
    allowEIO3: true,
});
// Store active streams per socket
const socketStreams = new Map();
// Helper to verify JWT from socket handshake
function verifySocketToken(socket) {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token)
            return null;
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };
    }
    catch (error) {
        console.error("Socket token verification failed:", error);
        return null;
    }
}
io.on("connection", (socket) => {
    const user = verifySocketToken(socket);
    if (!user) {
        socket.disconnect();
        return;
    }
    // Initialize streams map for this socket
    socketStreams.set(socket.id, new Map());
    // Join event room for chat
    socket.on("join-room", async (eventId) => {
        try {
            // Check if already joined to prevent duplicate streams
            const streams = socketStreams.get(socket.id);
            if (streams && (streams.has(`room-${eventId}`) || streams.has(`interaction-${eventId}`))) {
                return;
            }
            await socket.join(eventId);
            // Call gRPC JoinRoom (don't fail if gRPC is unavailable - WebRTC can still work)
            try {
                await (0, grpc_client_1.callGrpc)(grpc_client_1.roomClient, "JoinRoom", {
                    event_id: eventId,
                    user_id: user.userId,
                    is_host: user.role === "HOST" || user.role === "ADMIN",
                });
            }
            catch (error) {
                // If gRPC fails, continue - Socket.IO room join above still works
            }
            // Subscribe to room events stream (only if gRPC is available)
            try {
                const roomStream = (0, grpc_client_1.createStream)(grpc_client_1.roomClient, "StreamRoomEvents", { event_id: eventId }, (event) => {
                    // Forward room events to Socket.IO clients
                    const payload = JSON.parse(event.payload_json || "{}");
                    io.to(eventId).emit(event.type.toLowerCase().replace(/_/g, "-"), {
                        ...payload,
                        userId: event.user_id,
                    });
                });
                // Store stream
                if (streams) {
                    streams.set(`room-${eventId}`, roomStream);
                }
            }
            catch (error) {
                // gRPC stream creation failed - continue without it
                // Socket.IO room join above still works
            }
            // Subscribe to interaction events stream
            // Capture eventId in closure to ensure it's available in the callback
            const streamEventId = eventId;
            try {
                const interactionStream = (0, grpc_client_1.createStream)(grpc_client_1.interactionClient, "StreamInteractionEvents", { event_id: streamEventId }, (event) => {
                    // Handle both snake_case and camelCase field names (proto loader with keepCase: true)
                    const payloadJson = event.payload_json || event.payloadJson || "{}";
                    const userId = event.user_id || event.userId || "";
                    let payload = {};
                    try {
                        if (payloadJson && payloadJson !== "{}") {
                            payload = JSON.parse(payloadJson);
                        }
                    }
                    catch (error) {
                        console.error("Failed to parse payload_json:", error);
                        payload = {};
                    }
                    // Ensure user object exists in payload
                    if (!payload.user && userId) {
                        payload.user = {
                            id: userId,
                            name: "User",
                            role: "PARTICIPANT",
                        };
                    }
                    // Map interaction event types to Socket.IO events
                    if (event.type === "MESSAGE") {
                        const messageToEmit = {
                            id: payload.id || `msg-${Date.now()}`,
                            content: payload.content || "",
                            user: payload.user || {
                                id: userId || "",
                                name: "Unknown User",
                                role: "PARTICIPANT",
                            },
                            timestamp: payload.timestamp || new Date().toISOString(),
                            reactions: payload.reactions || {},
                            userId: userId,
                        };
                        io.to(streamEventId).emit("new-message", messageToEmit);
                    }
                    else if (event.type === "POLL_CREATED") {
                        io.to(streamEventId).emit("new-poll", payload);
                    }
                    else if (event.type === "QUIZ_CREATED") {
                        io.to(streamEventId).emit("new-quiz", payload);
                    }
                    else if (event.type === "QUESTION_SUBMITTED") {
                        io.to(streamEventId).emit("question-submitted", payload);
                    }
                    else if (event.type === "QUESTION_APPROVED") {
                        io.to(streamEventId).emit("question-approved", payload);
                    }
                    else if (event.type === "POLL_RESPONSE") {
                        io.to(streamEventId).emit("poll-update", payload);
                    }
                });
                if (streams) {
                    streams.set(`interaction-${eventId}`, interactionStream);
                }
            }
            catch (error) {
                // gRPC stream creation failed - continue without it
                // Socket.IO room join above still works
            }
        }
        catch (error) {
            console.error("Error joining room:", error);
            socket.emit("error", { message: "Failed to join room" });
        }
    });
    // WebRTC Room Management
    socket.on("join-webrtc-room", async (data) => {
        try {
            const { eventId, isHost } = data;
            if (!eventId) {
                socket.emit("error", { message: "eventId is required" });
                return;
            }
            socket.join(`webrtc-${eventId}`);
            // Call gRPC JoinRoom with is_host flag (don't fail if already joined)
            try {
                await (0, grpc_client_1.callGrpc)(grpc_client_1.roomClient, "JoinRoom", {
                    event_id: eventId,
                    user_id: user.userId,
                    is_host: isHost,
                });
            }
            catch (error) {
                // If already exists or already joined, that's fine
                if (error.code !== 6 && error.code !== 13) { // 6 = ALREADY_EXISTS, 13 = INTERNAL (might be re-join)
                    socket.emit("error", { message: "Failed to join WebRTC room" });
                    return;
                }
            }
            // Notify existing participants about new user
            socket.to(`webrtc-${eventId}`).emit("user-joined", {
                userId: socket.id,
                isHost: isHost,
            });
        }
        catch (error) {
            // Even if gRPC JoinRoom fails, we can still proceed with WebRTC
            // The Socket.IO room join above should still work
            // Don't emit error to client - let WebRTC proceed anyway
        }
    });
    // WebRTC Signaling for screen share
    socket.on("offer", (data) => {
        // If targetUserId is "host", broadcast to all viewers in the room
        if (data.targetUserId === "host") {
            socket.to(`webrtc-${data.eventId}`).emit("offer", {
                fromUserId: socket.id,
                offer: data.offer,
            });
        }
        else {
            // Send to specific viewer by socket ID
            io.to(data.targetUserId).emit("offer", {
                fromUserId: socket.id,
                offer: data.offer,
            });
        }
    });
    socket.on("answer", (data) => {
        // Send answer to the host (targetUserId is the host's socket.id)
        io.to(data.targetUserId).emit("answer", {
            fromUserId: socket.id,
            answer: data.answer,
        });
    });
    socket.on("ice-candidate", (data) => {
        // If targetUserId is "host", broadcast to all viewers in the room
        if (data.targetUserId === "host") {
            socket.to(`webrtc-${data.eventId}`).emit("ice-candidate", {
                fromUserId: socket.id,
                candidate: data.candidate,
            });
        }
        else {
            // Send to specific socket
            io.to(data.targetUserId).emit("ice-candidate", {
                fromUserId: socket.id,
                candidate: data.candidate,
            });
        }
    });
    // Screen share events
    socket.on("screen-share-started", (data) => {
        // Broadcast to all viewers in the WebRTC room (use io.to to include all sockets)
        io.to(`webrtc-${data.eventId}`).emit("screen-share-started", data);
    });
    socket.on("screen-share-stopped", (data) => {
        io.to(`webrtc-${data.eventId}`).emit("screen-share-stopped", data);
    });
    socket.on("viewer-joined", (data) => {
        // Notify host that a viewer joined (for creating peer connection)
        // Broadcast to all sockets in the room - host will handle it
        io.to(`webrtc-${data.eventId}`).emit("viewer-joined", {
            viewerId: data.viewerId,
        });
    });
    socket.on("request-viewers", (data) => {
        // Host requests existing viewers to connect
        // Broadcast to all viewers in the room
        io.to(`webrtc-${data.eventId}`).emit("request-viewers", data);
    });
    // Host media state updates
    socket.on("host-media-state", async (data) => {
        try {
            await (0, grpc_client_1.callGrpc)(grpc_client_1.roomClient, "UpdateMediaState", {
                event_id: data.eventId,
                has_video: data.hasVideo ?? false,
                has_audio: data.hasAudio ?? false,
                has_screen: data.hasScreen ?? false,
            });
            socket.to(`webrtc-${data.eventId}`).emit("host-media-state", {
                hasVideo: data.hasVideo,
                hasAudio: data.hasAudio,
                hasScreen: data.hasScreen,
            });
        }
        catch (error) {
            console.error("Error updating media state:", error);
        }
    });
    // Chat messages - call gRPC
    socket.on("new-message", async (data) => {
        try {
            await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "SendMessage", {
                event_id: data.eventId,
                user_id: user.userId,
                content: data.content,
            });
            // The gRPC service will emit the message via interaction stream
        }
        catch (error) {
            console.error("Error sending message:", error);
            socket.emit("error", { message: "Failed to send message" });
        }
    });
    // Interactive features
    socket.on("new-quiz", async (data) => {
        try {
            // Save quiz to database via gRPC
            const result = await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "CreateQuiz", {
                event_id: data.eventId,
                question: data.quiz.question,
                options: data.quiz.options,
                correct_answer: data.quiz.correctAnswer,
                time_limit: data.quiz.timeLimit || 30,
            });
            // The gRPC service will emit the event via interaction stream
            // Also broadcast directly for immediate update
            const quizWithId = { ...data.quiz, id: result.quiz_id };
            socket.to(data.eventId).emit("new-quiz", quizWithId);
        }
        catch (error) {
            // If gRPC is unavailable, still broadcast the quiz (but it won't be saved)
            if (error.code === 14 || error.message?.includes("ECONNREFUSED")) {
                console.warn("gRPC unavailable - broadcasting quiz without saving to database");
                const quizWithId = { ...data.quiz, id: Date.now().toString() };
                socket.to(data.eventId).emit("new-quiz", quizWithId);
            }
            else {
                console.error("Error creating quiz:", error);
                socket.emit("error", { message: "Failed to create quiz" });
            }
        }
    });
    socket.on("quiz-response", async (data) => {
        try {
            await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "SendQuizResponse", {
                event_id: data.eventId,
                user_id: user.userId,
                quiz_id: data.quizId,
                option_id: data.optionId,
            });
        }
        catch (error) {
            console.error("Error sending quiz response:", error);
        }
    });
    socket.on("new-poll", async (data) => {
        try {
            // Save poll to database via gRPC
            const result = await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "CreatePoll", {
                event_id: data.eventId,
                question: data.poll.question,
                options: data.poll.options,
            });
            // The gRPC service will emit the event via interaction stream
            // Also broadcast directly for immediate update
            const pollWithId = { ...data.poll, id: result.poll_id };
            socket.to(data.eventId).emit("new-poll", pollWithId);
        }
        catch (error) {
            // If gRPC is unavailable, still broadcast the poll (but it won't be saved)
            if (error.code === 14 || error.message?.includes("ECONNREFUSED")) {
                console.warn("gRPC unavailable - broadcasting poll without saving to database");
                const pollWithId = { ...data.poll, id: Date.now().toString() };
                socket.to(data.eventId).emit("new-poll", pollWithId);
            }
            else {
                console.error("Error creating poll:", error);
                socket.emit("error", { message: "Failed to create poll" });
            }
        }
    });
    socket.on("poll-response", async (data) => {
        try {
            await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "SendPollResponse", {
                event_id: data.eventId,
                user_id: user.userId,
                poll_id: data.pollId,
                option_id: data.optionId,
            });
        }
        catch (error) {
            console.error("Error sending poll response:", error);
        }
    });
    socket.on("question-submitted", async (data) => {
        try {
            // Save question to database via gRPC
            const result = await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "CreateQuestion", {
                event_id: data.eventId,
                user_id: user.userId,
                question: data.question,
            });
            // The gRPC service will emit the event via interaction stream
            // Also broadcast directly for immediate update (host will see it)
            socket.to(data.eventId).emit("question-submitted", {
                id: result.question_id,
                question: data.question,
                approved: false,
                user: { name: user.email, id: user.userId },
            });
        }
        catch (error) {
            // If gRPC is unavailable, still broadcast the question (but it won't be saved)
            if (error.code === 14 || error.message?.includes("ECONNREFUSED")) {
                console.warn("gRPC unavailable - broadcasting question without saving to database");
                socket.to(data.eventId).emit("question-submitted", {
                    id: Date.now().toString(),
                    question: data.question,
                    approved: false,
                    user: { name: user.email, id: user.userId },
                });
            }
            else {
                console.error("Error creating question:", error);
                socket.emit("error", { message: "Failed to submit question" });
            }
        }
    });
    socket.on("question-approved", async (data) => {
        try {
            // Approve question in database via gRPC
            await (0, grpc_client_1.callGrpc)(grpc_client_1.interactionClient, "ApproveQuestion", {
                question_id: data.questionId,
                event_id: data.eventId,
            });
            // The gRPC service will emit the event via interaction stream
            // Also broadcast directly for immediate update
            socket.to(data.eventId).emit("question-approved", {
                id: data.questionId,
                approved: true,
            });
        }
        catch (error) {
            // If gRPC is unavailable, still broadcast the approval (but it won't be saved)
            if (error.code === 14 || error.message?.includes("ECONNREFUSED")) {
                console.warn("gRPC unavailable - broadcasting question approval without saving to database");
                socket.to(data.eventId).emit("question-approved", {
                    id: data.questionId,
                    approved: true,
                });
            }
            else {
                console.error("Error approving question:", error);
                socket.emit("error", { message: "Failed to approve question" });
            }
        }
    });
    // Handle disconnection
    socket.on("disconnect", async () => {
        // Clean up streams
        const streams = socketStreams.get(socket.id);
        if (streams) {
            streams.forEach((stream) => {
                stream.cancel();
            });
            socketStreams.delete(socket.id);
        }
        // Leave all rooms (would need to track which rooms socket was in)
        // For now, just log
    });
});
httpServer.listen(PORT, () => {
    // WebSocket gateway listening
});
