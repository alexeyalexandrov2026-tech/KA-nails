import { isWorkersModel, type WorkersModel } from "./workers-ai";

export interface ChatConfig {
  allowedOrigins: string[];
  model: WorkersModel;
  database?: { url: string; secret: string };
  telegram?: { token: string; chatId: string };
  email?: { from: string; to: string };
  turnstileSecret?: string;
  dailyLimit: number;
  dailyRequestLimit: number;
}

function configured(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 10_000
    ? parsed
    : fallback;
}

type Setting =
  | "ALLOWED_ORIGINS"
  | "WORKERS_AI_MODEL"
  | "SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_CHAT_ID"
  | "EMAIL_SENDER"
  | "EMAIL_TO"
  | "TURNSTILE_SECRET"
  | "DAILY_MESSAGE_LIMIT"
  | "DAILY_REQUEST_LIMIT";

export function readConfig(env: Partial<Record<Setting, unknown>>): ChatConfig {
  const origins = (configured(env.ALLOWED_ORIGINS) ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const model = configured(env.WORKERS_AI_MODEL) ?? "";
  if (!isWorkersModel(model)) throw new Error("Invalid WORKERS_AI_MODEL");
  const url = configured(env.SUPABASE_URL);
  const secret = configured(env.SUPABASE_SECRET_KEY);
  const token = configured(env.TELEGRAM_BOT_TOKEN);
  const chatId = configured(env.TELEGRAM_CHAT_ID);
  const from = configured(env.EMAIL_SENDER);
  const to = configured(env.EMAIL_TO);
  return {
    allowedOrigins: origins,
    model,
    database:
      url && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) && secret
        ? { url, secret }
        : undefined,
    telegram: token && chatId ? { token, chatId } : undefined,
    email: from && to ? { from, to } : undefined,
    turnstileSecret: configured(env.TURNSTILE_SECRET),
    dailyLimit: positiveInteger(env.DAILY_MESSAGE_LIMIT, 500),
    dailyRequestLimit: positiveInteger(env.DAILY_REQUEST_LIMIT, 20),
  };
}
