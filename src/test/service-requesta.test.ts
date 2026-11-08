import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  formatPilotDate,
  friendlyError,
  normalizeSouthAfricanPhone,
  parseZarToCents,
  formatZarCents,
  statusLabel,
  validateRequestDraft,
} from "@/lib/service-requesta";

describe("Service-Requesta pilot helpers", () => {
  it("accepts only the three pilot service categories", () => {
    expect(categoryLabel("plumbing")).toBe("Plumbing");
    expect(categoryLabel("electrical")).toBe("Electrical");
    expect(categoryLabel("motor_mechanics")).toBe("Motor mechanics");
    expect(categoryLabel("carpentry")).toBe("Service request");
  });

  it("does not reveal whether an email is already registered", () => {
    expect(friendlyError({ message: "User already registered" })).toBe(
      "Could not create account with those details. Try signing in or resetting your password.",
    );
  });

  it("normalizes common South African mobile number formats", () => {
    expect(normalizeSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("821234567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("123")).toBeNull();
    expect(normalizeSouthAfricanPhone("")).toBeNull();
  });

  it("checks request fields before they are sent to the database", () => {
    expect(
      validateRequestDraft({
        category: "plumbing",
        title: "Leaking kitchen tap",
        description: "The tap has been leaking since yesterday and needs attention.",
        area: "Southernwood",
        timing: "this_week",
      }),
    ).toEqual({});

    expect(
      validateRequestDraft({
        category: "carpentry",
        title: "Tap",
        description: "Short",
        area: "x",
        timing: "tomorrow",
      }),
    ).toMatchObject({
      category: "Choose one of the pilot services.",
      title: "Use 5 to 120 characters.",
      description: "Use 20 to 2,000 characters and describe the issue clearly.",
      area: "Use 2 to 100 characters.",
      timing: "Choose a timing option.",
    });
  });

  it("parses and formats Rand amounts using integer cents", () => {
    expect(parseZarToCents("0.01")).toBe(1);
    expect(parseZarToCents("12")).toBe(1200);
    expect(parseZarToCents("12.3")).toBe(1230);
    expect(parseZarToCents("999999999.99")).toBe(99999999999);
    expect(parseZarToCents("1000000000.00")).toBe(100000000000);
    expect(parseZarToCents("1000000000.01")).toBeNull();
    expect(parseZarToCents("1.234")).toBeNull();
    expect(parseZarToCents("-1.00")).toBeNull();
    expect(parseZarToCents("1e3")).toBeNull();
    expect(formatZarCents(1)).toBe("R 0.01");
    expect(formatZarCents(1234)).toBe("R 12.34");
    expect(formatZarCents(Number.MAX_SAFE_INTEGER + 1)).toBe("Amount unavailable");
  });

  it("formats dates in South African local time and handles bad values", () => {
    expect(formatPilotDate("not-a-date")).toBe("Date unavailable");
    expect(formatPilotDate("2026-11-07T10:00:00.000Z")).toContain("2026");
  });

  it("uses clear labels for customer-visible request status", () => {
    expect(statusLabel("submitted")).toBe("Saved for the pilot");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });
});
