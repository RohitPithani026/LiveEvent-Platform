"use strict";
// In-memory room state manager
// In production, use Redis for distributed state
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomManager = void 0;
exports.setInteractionEventType = setInteractionEventType;
// Store reference to InteractionEvent message type for proper serialization
let InteractionEventType = null;
function setInteractionEventType(type) {
    InteractionEventType = type;
}
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.eventStreams = new Map(); // gRPC streams per room
        this.interactionStreams = new Map(); // Interaction event streams per room
    }
    getOrCreateRoom(eventId) {
        if (!this.rooms.has(eventId)) {
            this.rooms.set(eventId, {
                eventId,
                participants: new Map(),
                mediaState: {
                    hasVideo: false,
                    hasAudio: false,
                    hasScreen: false,
                },
            });
        }
        return this.rooms.get(eventId);
    }
    getRoom(eventId) {
        return this.rooms.get(eventId);
    }
    joinRoom(eventId, userId, isHost) {
        const room = this.getOrCreateRoom(eventId);
        // Only one host allowed
        if (isHost) {
            const existingHost = Array.from(room.participants.values()).find(p => p.isHost);
            if (existingHost && existingHost.userId !== userId) {
                return false; // Host already exists
            }
        }
        room.participants.set(userId, {
            userId,
            isHost,
            joinedAt: new Date(),
        });
        // Emit USER_JOINED event
        this.emitRoomEvent(eventId, {
            type: "USER_JOINED",
            userId,
            payloadJson: JSON.stringify({ isHost }),
        });
        return true;
    }
    leaveRoom(eventId, userId) {
        const room = this.rooms.get(eventId);
        if (!room)
            return;
        const wasHost = room.participants.get(userId)?.isHost || false;
        room.participants.delete(userId);
        // Emit USER_LEFT event
        this.emitRoomEvent(eventId, {
            type: "USER_LEFT",
            userId,
            payloadJson: JSON.stringify({ wasHost }),
        });
        // Clean up empty rooms
        if (room.participants.size === 0) {
            this.rooms.delete(eventId);
            this.eventStreams.delete(eventId);
        }
    }
    updateMediaState(eventId, hasVideo, hasAudio, hasScreen) {
        const room = this.getOrCreateRoom(eventId);
        room.mediaState = { hasVideo, hasAudio, hasScreen };
        // Emit HOST_MEDIA_UPDATED event
        this.emitRoomEvent(eventId, {
            type: "HOST_MEDIA_UPDATED",
            userId: "",
            payloadJson: JSON.stringify({ hasVideo, hasAudio, hasScreen }),
        });
    }
    subscribeToRoomEvents(eventId, stream) {
        if (!this.eventStreams.has(eventId)) {
            this.eventStreams.set(eventId, new Set());
        }
        this.eventStreams.get(eventId).add(stream);
    }
    unsubscribeFromRoomEvents(eventId, stream) {
        const streams = this.eventStreams.get(eventId);
        if (streams) {
            streams.delete(stream);
        }
    }
    getRoomParticipants(eventId) {
        const room = this.rooms.get(eventId);
        if (!room)
            return [];
        return Array.from(room.participants.values());
    }
    subscribeToInteractionEvents(eventId, stream) {
        if (!this.interactionStreams.has(eventId)) {
            this.interactionStreams.set(eventId, new Set());
        }
        this.interactionStreams.get(eventId).add(stream);
    }
    unsubscribeFromInteractionEvents(eventId, stream) {
        const streams = this.interactionStreams.get(eventId);
        if (streams) {
            streams.delete(stream);
        }
    }
    emitInteractionEvent(eventId, event) {
        const streams = this.interactionStreams.get(eventId);
        if (!streams) {
            return;
        }
        // Validate payloadJson is a non-empty string
        if (!event.payloadJson || typeof event.payloadJson !== "string" || event.payloadJson.trim() === "") {
            console.error("Invalid payloadJson in emitInteractionEvent");
            return;
        }
        // Convert to proto format (snake_case) for gRPC
        const protoEvent = {
            type: String(event.type || ""),
            user_id: String(event.userId || ""),
            payload_json: String(event.payloadJson || ""),
        };
        streams.forEach((stream) => {
            try {
                // Use the proto message type if available, otherwise use plain object
                let eventToWrite;
                if (InteractionEventType && typeof InteractionEventType === 'function') {
                    try {
                        eventToWrite = new InteractionEventType(protoEvent);
                    }
                    catch (error) {
                        // Fallback to plain object
                        eventToWrite = protoEvent;
                    }
                }
                else {
                    eventToWrite = protoEvent;
                }
                stream.write(eventToWrite);
            }
            catch (error) {
                console.error("Error writing to interaction stream:", error);
                streams.delete(stream);
            }
        });
    }
    emitRoomEvent(eventId, event) {
        const streams = this.eventStreams.get(eventId);
        if (!streams)
            return;
        // Convert to proto format (snake_case) for gRPC
        const protoEvent = {
            type: event.type,
            user_id: event.userId,
            payload_json: event.payloadJson,
        };
        streams.forEach((stream) => {
            try {
                stream.write(protoEvent);
            }
            catch (error) {
                console.error("Error writing to stream:", error);
                streams.delete(stream);
            }
        });
    }
}
exports.roomManager = new RoomManager();
