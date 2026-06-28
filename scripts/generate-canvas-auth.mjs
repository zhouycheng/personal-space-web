import crypto from "node:crypto";

const authToken = crypto.randomBytes(32).toString("hex");

console.log("\nAdd this runtime-only secret to your .env.local or deployment environment:\n");
console.log(`CANVAS_AUTH_TOKEN=${authToken}`);
