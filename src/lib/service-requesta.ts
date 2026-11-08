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
    return "Could not create account with those details. Try signing in or resetting your password.";
  }
  if (message.includes("limit of 5 requests per hour")) {
    return "You have reached the pilot limit of 5 requests in one hour. Try again later.";
  }
  if (message.includes("customer privacy consent required")) {
    return "Please accept the pilot privacy notice before saving a request.";
  }
  if (message.includes("live marketplace is not open")) return "Live requests are not available in this controlled pilot yet.";
  if (message.includes("approved matching provider application required")) return "Only a fully reviewed provider whose service and area match can accept this request.";
  if (message.includes("this request is no longer available")) return "Another provider accepted this request or it has changed. Refresh to see the latest status.";
  if (message.includes("only the accepting provider can quote")) return "Only the provider who accepted this request can submit its quote.";
  if (message.includes("only the selected provider")) return "Only the provider chosen by the customer can update this job.";
  if (message.includes("contact details are available only after quote approval")) return "Customer contact details are available after the customer approves your quote.";
  if (message.includes("separate consent and valid service contact details are required")) return "Provide the service address and a valid phone number, then accept the separate sharing notice.";
  if (message.includes("account type is locked")) return "This account already has profile or request activity. Create a separate provider account.";
  if (message.includes("open support case already exists")) return "This job already has an open support case.";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "We could not connect just now. Check your connection and try again.";
  }
  return "We could not complete that action. Please try again.";
}

export function parseZarToCents(value: string): number | null {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100n + fraction;
  if (cents > 100000000000n) return null;
  return Number(cents);
}

export function formatZarCents(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return "Amount unavailable";
  const cents = BigInt(value);
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return "R " + new Intl.NumberFormat("en-ZA").format(whole) + "." + fraction;
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
