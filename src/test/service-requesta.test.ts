import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  formatPilotDate,
  normalizeSouthAfricanPhone,
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

  it("formats dates in South African local time and handles bad values", () => {
    expect(formatPilotDate("not-a-date")).toBe("Date unavailable");
    expect(formatPilotDate("2026-11-07T10:00:00.000Z")).toContain("2026");
  });

  it("uses clear labels for customer-visible request status", () => {
    expect(statusLabel("submitted")).toBe("Saved for the pilot");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });
});
