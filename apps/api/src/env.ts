import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().default(3001),
});

export function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${keys}. See .env.example.`);
  }
  return { ...parsed.data, API_PUBLIC_URL: parsed.data.API_PUBLIC_URL.replace(/\/$/, "") };
}
