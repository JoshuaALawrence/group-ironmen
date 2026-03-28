import { describe, it, expect } from "vitest";
import {
  captchaEnabledSchema,
  createGroupRequestSchema,
  createGroupResponseSchema,
  groupNameSchema,
  loginFieldSchema,
  memberNameSchema,
  storedGroupSchema,
  validationErrorFromSchema,
  validCharacters,
  validLength,
} from "../validators";

describe("validCharacters", () => {
  it("accepts alphanumeric characters", () => {
    expect(validCharacters("abc123")).toBe(true);
  });

  it("accepts spaces", () => {
    expect(validCharacters("hello world")).toBe(true);
  });

  it("accepts dashes", () => {
    expect(validCharacters("iron-man")).toBe(true);
  });

  it("accepts underscores", () => {
    expect(validCharacters("iron_man")).toBe(true);
  });

  it("accepts mixed valid characters", () => {
    expect(validCharacters("My Group-Name_1")).toBe(true);
  });

  it("rejects special characters", () => {
    expect(validCharacters("hello!")).toBe(false);
    expect(validCharacters("test@name")).toBe(false);
    expect(validCharacters("name#1")).toBe(false);
    expect(validCharacters("a+b")).toBe(false);
  });

  it("rejects symbols", () => {
    expect(validCharacters("<script>")).toBe(false);
    expect(validCharacters("a&b")).toBe(false);
    expect(validCharacters("100%")).toBe(false);
  });

  it("accepts empty string", () => {
    expect(validCharacters("")).toBe(true);
  });

  it("accepts single character", () => {
    expect(validCharacters("a")).toBe(true);
    expect(validCharacters("1")).toBe(true);
  });

  it("accepts uppercase letters", () => {
    expect(validCharacters("ALLCAPS")).toBe(true);
  });
});

describe("validLength", () => {
  it("accepts names between 1 and 16 characters", () => {
    expect(validLength("a")).toBe(true);
    expect(validLength("abcdefghijklmnop")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(validLength("")).toBe(false);
  });

  it("rejects strings longer than 16 characters", () => {
    expect(validLength("abcdefghijklmnopq")).toBe(false);
  });

  it("accepts boundary values", () => {
    expect(validLength("a")).toBe(true);
    expect(validLength("1234567890123456")).toBe(true);
  });

  it("rejects boundary violations", () => {
    expect(validLength("")).toBe(false);
    expect(validLength("12345678901234567")).toBe(false);
  });
});

describe("Zod schemas", () => {
  it("validates group names", () => {
    expect(validationErrorFromSchema(groupNameSchema, "My Group")).toBe(null);
    expect(validationErrorFromSchema(groupNameSchema, "   ")).toBe("Group name must be between 1 and 16 characters.");
    expect(validationErrorFromSchema(groupNameSchema, "name!")).toBe(
      "Group name has some unsupported special characters."
    );
  });

  it("validates member names", () => {
    expect(validationErrorFromSchema(memberNameSchema, "Member 1")).toBe(null);
    expect(validationErrorFromSchema(memberNameSchema, " ")).toBe(
      "Character name must be between 1 and 16 characters."
    );
  });

  it("validates login fields", () => {
    expect(validationErrorFromSchema(loginFieldSchema, "token")).toBe(null);
    expect(validationErrorFromSchema(loginFieldSchema, "   ")).toBe("This field is required.");
  });

  it("accepts padded create group requests", () => {
    expect(
      createGroupRequestSchema.parse({
        name: "Group One",
        member_names: ["Alice", "", "", "", ""],
        captcha_response: "",
      })
    ).toEqual({
      name: "Group One",
      member_names: ["Alice", "", "", "", ""],
      captcha_response: "",
    });
  });

  it("validates create group responses", () => {
    expect(
      createGroupResponseSchema.parse({
        name: "Group One",
        member_names: ["Alice"],
        token: "secret-token",
      })
    ).toEqual({
      name: "Group One",
      member_names: ["Alice"],
      token: "secret-token",
    });
  });

  it("validates captcha enabled responses", () => {
    expect(captchaEnabledSchema.parse({ enabled: false, sitekey: "" })).toEqual({ enabled: false, sitekey: "" });
  });

  it("validates stored group records", () => {
    expect(storedGroupSchema.parse({ groupName: "@EXAMPLE", groupToken: "abc123" })).toEqual({
      groupName: "@EXAMPLE",
      groupToken: "abc123",
    });
  });
});
