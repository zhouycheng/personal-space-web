import crypto from "node:crypto";

function generate(passphrase) {
  const authToken = crypto.randomBytes(32).toString("hex");
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const key = crypto.pbkdf2Sync(passphrase, salt, 600000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(authToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encryptedToken = Buffer.concat([iv, encrypted, authTag]);

  return {
    CANVAS_AUTH_TOKEN: authToken,
    CANVAS_SALT: salt.toString("base64"),
    CANVAS_ENCRYPTED_TOKEN: encryptedToken.toString("base64"),
  };
}

const passphrase = process.argv[2];
if (!passphrase) {
  console.error("Usage: node scripts/generate-canvas-auth.mjs <passphrase>");
  process.exit(1);
}

const vars = generate(passphrase);
console.log("\nAdd these to your .env.local:\n");
for (const [key, value] of Object.entries(vars)) {
  console.log(`${key}=${value}`);
}
