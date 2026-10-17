import { describe, expect, it } from "vitest";
import { loginCredentialsSchema, signupCredentialsSchema } from "./schemas";

describe("authentication input", () => {
  it("accepts valid login credentials and normalizes the email", () => {
    expect(loginCredentialsSchema.parse({ email: "  TEST@EXAMPLE.COM ", password: "existing-password" })).toEqual({
      email: "test@example.com",
      password: "existing-password",
    });
  });

  it("rejects an invalid email and a short new-account password", () => {
    expect(loginCredentialsSchema.safeParse({ email: "invalid", password: "x" }).success).toBe(false);
    expect(signupCredentialsSchema.safeParse({ email: "test@example.com", password: "short" }).success).toBe(false);
  });
});
