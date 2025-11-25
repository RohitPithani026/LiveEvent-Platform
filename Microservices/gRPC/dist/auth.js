"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.extractTokenFromMetadata = extractTokenFromMetadata;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
function verifyToken(token) {
    try {
        if (!JWT_SECRET || JWT_SECRET === "your-secret-key") {
            console.error("JWT_SECRET is not set or using default value!");
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        console.error("Token verification failed:", error.message);
        return null;
    }
}
function extractTokenFromMetadata(metadata) {
    const authHeader = metadata.get("authorization")?.[0];
    if (!authHeader)
        return null;
    // Handle "Bearer <token>" format
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    return authHeader;
}
