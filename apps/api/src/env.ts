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
const prod = z.object({
  ...base,
  API_PUBLIC_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
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
