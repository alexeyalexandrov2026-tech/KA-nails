// Settings come from the Function App's application settings (Bicep in
// infra/azure/chat.bicep). Secrets are Key Vault references there, so they
// never appear in code, in the repository or in CI.

export interface ChatConfig {
  allowedOrigins: string[];
  foundryResource: string;
  foundryDeployment: string;
  storageTableEndpoint: string;
  telegram?: { token: string; chatId: string };
  email?: { endpoint: string; sender: string; to: string };
  turnstileSecret?: string;
  /** False only with HUMAN_CHECK=off; otherwise no secret means no chat. */
  requireHumanCheck: boolean;
  dailyLimit: number;
  dailyRequestLimit: number;
  ratePerTenMinutes: number;
}

/**
 * A setting that is unset, "none", or a Key Vault reference Azure could not
 * resolve (the secret does not exist yet) counts as not configured.
 */
function optional(value: string | undefined): string | undefined {
  const clean = value?.trim();
  if (!clean || clean === "none" || clean.startsWith("@Microsoft.KeyVault(")) {
    return undefined;
  }
  return clean;
}

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv): ChatConfig {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`missing setting ${name}`);
    return value;
  };
  const telegramToken = optional(env.TELEGRAM_BOT_TOKEN);
  const telegramChat = optional(env.TELEGRAM_CHAT_ID);
  const emailEndpoint = optional(env.ACS_ENDPOINT);
  const emailSender = optional(env.EMAIL_SENDER);
  const emailTo = optional(env.EMAIL_TO);
  return {
    allowedOrigins: required("ALLOWED_ORIGINS")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    foundryResource: required("FOUNDRY_RESOURCE"),
    foundryDeployment: env.FOUNDRY_DEPLOYMENT?.trim() || "claude-haiku-4-5",
    storageTableEndpoint: required("STORAGE_TABLE_ENDPOINT"),
    telegram:
      telegramToken && telegramChat
        ? { token: telegramToken, chatId: telegramChat }
        : undefined,
    email:
      emailEndpoint && emailSender && emailTo
        ? { endpoint: emailEndpoint, sender: emailSender, to: emailTo }
        : undefined,
    turnstileSecret: optional(env.TURNSTILE_SECRET),
    requireHumanCheck: env.HUMAN_CHECK?.trim().toLowerCase() !== "off",
    dailyLimit: number(env.DAILY_MESSAGE_LIMIT, 500),
    dailyRequestLimit: number(env.DAILY_REQUEST_LIMIT, 20),
    ratePerTenMinutes: number(env.RATE_LIMIT_PER_10_MIN, 20),
  };
}

/** What /api/health reports: which parts are switched on, never the values. */
export function healthReport(config: ChatConfig) {
  return {
    status: "ok",
    model: config.foundryDeployment,
    channels: {
      telegram: Boolean(config.telegram),
      email: Boolean(config.email),
    },
    // "missing": the check is required but has no secret, so every message
    // is refused until turnstile-secret is set in Key Vault.
    humanCheck: config.turnstileSecret
      ? "on"
      : config.requireHumanCheck
        ? "missing"
        : "off",
  };
}
