import { z } from "zod";

const base = {
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3001),
};

// In production the two URLs must be set. A silent localhost default would break CORS and every link.
const dev = z.object({
  ...base,
  API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
});
// Agent tokens travel inside these URLs, so production must use https.
const https = z.string().url().refine((u) => u.startsWith("https://"), "must start with https://");
const prod = z.object({
  ...base,
  API_PUBLIC_URL: https,
  WEB_ORIGIN: https,
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = (source.NODE_ENV === "production" ? prod : dev).safeParse(source);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${keys}. See .env.example.`);
  }
  const strip = (u: string) => u.replace(/\/+$/, "");
  return { ...parsed.data, API_PUBLIC_URL: strip(parsed.data.API_PUBLIC_URL), WEB_ORIGIN: strip(parsed.data.WEB_ORIGIN) };
}
