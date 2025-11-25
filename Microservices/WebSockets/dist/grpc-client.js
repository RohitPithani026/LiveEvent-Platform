"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionClient = exports.roomClient = void 0;
exports.callGrpc = callGrpc;
exports.createStream = createStream;
const grpc = __importStar(require("@grpc/grpc-js"));
const protoLoader = __importStar(require("@grpc/proto-loader"));
const path_1 = __importDefault(require("path"));
const PROTO_DIR = path_1.default.join(__dirname, "..", "..", "gRPC", "proto");
const GRPC_URL = process.env.GRPC_URL || "localhost:50051";
function loadProto(file) {
    const packageDefinition = protoLoader.loadSync(path_1.default.join(PROTO_DIR, file), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });
    return grpc.loadPackageDefinition(packageDefinition);
}
const roomProto = loadProto("room.proto");
const interactionProto = loadProto("interaction.proto");
const credentials = grpc.credentials.createInsecure();
exports.roomClient = new roomProto.room.RoomService(GRPC_URL, credentials);
exports.interactionClient = new interactionProto.interaction.InteractionService(GRPC_URL, credentials);
// Helper to call gRPC unary methods
function callGrpc(client, method, request) {
    return new Promise((resolve, reject) => {
        client[method](request, (error, response) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(response);
            }
        });
    });
}
// Track which stream types have already logged connection errors
const loggedConnectionErrors = new Set();
// Helper to create streaming client
function createStream(client, method, request, onData) {
    const stream = client[method](request);
    stream.on("data", (data) => {
        onData(data);
    });
    stream.on("error", (err) => {
        // Suppress connection errors - they're expected when gRPC server is not running
        if (err.code === 14) {
            // UNAVAILABLE error (connection refused or not available)
            // Only log once per stream method type
            if (!loggedConnectionErrors.has(method)) {
                console.warn(`gRPC server unavailable at ${GRPC_URL}. Stream ${method} will not work until gRPC server is started.`);
                loggedConnectionErrors.add(method);
            }
            // Silently handle connection errors - don't spam the console
            return;
        }
        // Log other errors (non-connection errors) normally
        console.error(`Stream error for ${method}:`, err.message || err.details || err);
    });
    stream.on("end", () => {
        // Stream ended normally
    });
    return stream;
}
