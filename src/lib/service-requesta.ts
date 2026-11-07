export const SERVICE_CATEGORIES = [
  {
    value: "plumbing",
    label: "Plumbing",
    detail: "Leaks, blocked drains, taps, and water systems.",
  },
  {
    value: "electrical",
    label: "Electrical",
    detail: "Lights, switches, wiring, and electrical faults.",
  },
  {
    value: "motor_mechanics",
    label: "Motor mechanics",
    detail: "Vehicle servicing and mechanical repairs.",
  },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["value"];
export type RequestTiming = "flexible" | "this_week" | "as_soon_as_possible";

export interface RequestDraft {
  category: string;
  title: string;
  description: string;
  area: string;
  timing: string;
}

export type RequestErrors = Partial<Record<keyof RequestDraft, string>>;

const CATEGORY_VALUES = new Set<string>(SERVICE_CATEGORIES.map((category) => category.value));
const TIMING_VALUES = new Set<RequestTiming>(["flexible", "this_week", "as_soon_as_possible"]);

export function validateRequestDraft(draft: RequestDraft): RequestErrors {
  const errors: RequestErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const area = draft.area.trim();

  if (!CATEGORY_VALUES.has(draft.category)) errors.category = "Choose one of the pilot services.";
  if (title.length < 5 || title.length > 120) {
    errors.title = "Use 5 to 120 characters.";
  }
  if (description.length < 20 || description.length > 2000) {
    errors.description = "Use 20 to 2,000 characters and describe the issue clearly.";
  }
  if (area.length < 2 || area.length > 100) errors.area = "Use 2 to 100 characters.";
  if (!TIMING_VALUES.has(draft.timing as RequestTiming)) errors.timing = "Choose a timing option.";

  return errors;
}

export function normalizeSouthAfricanPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+27") && digits.length === 11 && digits.startsWith("27")) {
    return "+" + digits;
  }
  if (digits.startsWith("27") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+27" + digits.slice(1);
  if (digits.length === 9) return "+27" + digits;
  return null;
}

export function createIdempotencyKey(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("A secure browser is required to submit a pilot request.");
  }
  return crypto.randomUUID();
}

export function friendlyError(error: unknown): string {
  const candidate =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : typeof error === "string"
        ? error
        : "";

  const message = candidate.toLowerCase();
  if (message.includes("invalid login credentials")) return "That email and password do not match.";
  if (message.includes("email not confirmed") || message.includes("email_not_confirmed")) {
    return "Please confirm your email, then try signing in again.";
  }
  if (message.includes("user already registered")) {
    return "That email already has an account. Try signing in instead.";
  }
  if (message.includes("limit of 5 requests per hour")) {
    return "You have reached the pilot limit of 5 requests in one hour. Try again later.";
  }
  if (message.includes("customer privacy consent required")) {
    return "Please accept the pilot privacy notice before saving a request.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "We could not connect just now. Check your connection and try again.";
  }
  return "We could not complete that action. Please try again.";
}

export function formatPilotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

export function categoryLabel(value: string): string {
  return (
    SERVICE_CATEGORIES.find((category) => category.value === value)?.label ?? "Service request"
  );
}

export function timingLabel(value: string): string {
  if (value === "as_soon_as_possible") return "As soon as possible";
  if (value === "this_week") return "This week";
  return "Flexible timing";
}

export function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    submitted: "Saved for the pilot",
    accepted: "Accepted",
    quoted: "Quote ready",
    approved: "Quote approved",
    in_progress: "In progress",
    awaiting_completion: "Awaiting completion",
    completed: "Completed",
    disputed: "Needs support",
    cancelled: "Cancelled",
  };
  return labels[value] ?? "Status unavailable";
}
