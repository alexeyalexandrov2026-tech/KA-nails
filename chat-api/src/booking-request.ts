import type Anthropic from "@anthropic-ai/sdk";
import type { StudioFacts } from "../../lib/studio-facts";

// The one action the receptionist can take: hand a visitor's request to the
// master. The model only proposes the details; the server checks every field
// against the published facts before anything is stored or sent.

export const TOOL_NAME = "submit_booking_request";

export interface BookingRequest {
  serviceId: string | null;
  addOnIds: string[];
  preferredTime: string;
  name: string;
  /** E.164, e.g. +15615550100. */
  phone: string;
  notes: string;
  language: "en" | "ru";
}

export function bookingTool(facts: StudioFacts): Anthropic.Tool {
  return {
    name: TOOL_NAME,
    description:
      "Send the visitor's appointment request to the master. Call it once, only after the visitor has confirmed the details. The master then contacts the visitor to confirm the time; this does not book an appointment.",
    input_schema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          enum: [...facts.services.map((s) => s.id), "not_sure"],
          description: 'Menu service id, or "not_sure".',
        },
        add_on_ids: {
          type: "array",
          items: { type: "string", enum: facts.addOns.map((a) => a.id) },
          description: "Add-on ids the visitor asked for, if any.",
        },
        preferred_time: {
          type: "string",
          description: "Preferred days and time, in the visitor's words.",
        },
        name: { type: "string", description: "The visitor's name." },
        phone: {
          type: "string",
          description: "The visitor's phone number, as they gave it.",
        },
        notes: {
          type: "string",
          description: "Anything else the master should know (optional).",
        },
        language: {
          type: "string",
          enum: ["en", "ru"],
          description: "The language of the conversation.",
        },
      },
      required: ["service_id", "preferred_time", "name", "phone", "language"],
    },
  };
}

const MAX_TEXT = 300;

/** US/Canada numbers may be given without +1; others need a country code. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type Validation =
  { ok: true; request: BookingRequest } | { ok: false; errors: string[] };

export function validateBookingRequest(
  input: unknown,
  facts: StudioFacts,
): Validation {
  const errors: string[] = [];
  const record =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const text = (key: string, required: boolean): string => {
    const value = record[key];
    if (value === undefined || value === null || value === "") {
      if (required) errors.push(`${key} is missing`);
      return "";
    }
    if (typeof value !== "string") {
      errors.push(`${key} must be text`);
      return "";
    }
    const clean = value.replace(/\s+/g, " ").trim();
    if (required && clean === "") errors.push(`${key} is missing`);
    if (clean.length > MAX_TEXT) errors.push(`${key} is too long`);
    return clean.slice(0, MAX_TEXT);
  };

  const serviceRaw = text("service_id", true);
  let serviceId: string | null = null;
  if (serviceRaw && serviceRaw !== "not_sure") {
    if (facts.services.some((service) => service.id === serviceRaw)) {
      serviceId = serviceRaw;
    } else {
      errors.push("service_id is not on the menu");
    }
  }

  const addOnIds: string[] = [];
  const rawAddOns = record.add_on_ids;
  if (rawAddOns !== undefined) {
    if (!Array.isArray(rawAddOns)) {
      errors.push("add_on_ids must be a list");
    } else {
      for (const id of rawAddOns) {
        if (typeof id === "string" && facts.addOns.some((a) => a.id === id)) {
          if (!addOnIds.includes(id)) addOnIds.push(id);
        } else {
          errors.push(`add-on ${String(id)} is not on the menu`);
        }
      }
    }
  }

  const preferredTime = text("preferred_time", true);
  const name = text("name", true);
  const phoneRaw = text("phone", true);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    errors.push(
      "phone is not a valid number (US numbers need 10 digits; others need a country code with +)",
    );
  }
  const notes = text("notes", false);
  const language = record.language === "ru" ? "ru" : "en";

  if (errors.length > 0 || !phone) return { ok: false, errors };
  return {
    ok: true,
    request: {
      serviceId,
      addOnIds,
      preferredTime,
      name,
      phone,
      notes,
      language,
    },
  };
}
