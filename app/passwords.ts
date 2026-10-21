import { scrypt, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

const COST = { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
const derive = (password: string, salt: Uint8Array) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, COST, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw Object.assign(new Error("Use uma senha entre 12 e 128 caracteres."), {
      status: 400,
    });
  }
}
export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `scrypt$32768$8$3$${Buffer.from(salt).toString("base64")}$${(await derive(password, salt)).toString("base64")}`;
}
export async function verifyPassword(password: unknown, record: string | null) {
  const validInput = typeof password === "string" && password.length <= 128;
  const parts = record?.split("$");
  const validRecord =
    parts?.length === 6 && parts.slice(0, 4).join("$") === "scrypt$32768$8$3";
  // Unknown accounts perform the same expensive derivation as valid accounts.
  const salt = validRecord
    ? Buffer.from(parts![4], "base64")
    : Buffer.alloc(16);
  const expected = validRecord
    ? Buffer.from(parts![5], "base64")
    : Buffer.alloc(32);
  const actual = await derive(
    validInput ? (password as string) : "invalid-password-input",
    salt,
  );
  return (
    !!validRecord &&
    validInput &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
