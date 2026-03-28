import { z } from "zod";

const NAME_CHARACTERS_REGEXP = /^[A-Za-z 0-9-_]*$/;

function createNameSchema(label: string) {
  return z
    .string()
    .min(1, { message: `${label} must be between 1 and 16 characters.` })
    .max(16, { message: `${label} must be between 1 and 16 characters.` })
    .regex(NAME_CHARACTERS_REGEXP, { message: `${label} has some unsupported special characters.` })
    .refine((value) => value.trim().length > 0, {
      message: `${label} must be between 1 and 16 characters.`,
    });
}

export const groupNameSchema = createNameSchema("Group name");

export const memberNameSchema = createNameSchema("Character name");

export const loginFieldSchema = z.string().trim().min(1, { message: "This field is required." });

export const createGroupRequestSchema = z.object({
  name: groupNameSchema,
  member_names: z.array(z.string().max(16).regex(NAME_CHARACTERS_REGEXP)).max(5),
  captcha_response: z.string(),
});

export const createGroupResponseSchema = z.object({
  name: groupNameSchema,
  member_names: z.array(memberNameSchema),
  token: z.string().min(1),
});

export const captchaEnabledSchema = z.object({
  enabled: z.boolean(),
  sitekey: z.string(),
});

export const storedGroupSchema = z.object({
  groupName: z.string().min(1),
  groupToken: z.string().min(1),
});

export function validationErrorFromSchema<T>(schema: z.ZodType<T>, value: unknown): string | null {
  const result = schema.safeParse(value);

  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message ?? "Invalid value";
}

export function validCharacters(value: string): boolean {
  return NAME_CHARACTERS_REGEXP.test(value);
}

export function validLength(value: string): boolean {
  return z.string().min(1).max(16).safeParse(value).success;
}

export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;
export type CreateGroupResponse = z.infer<typeof createGroupResponseSchema>;
export type CaptchaEnabledResponse = z.infer<typeof captchaEnabledSchema>;
export type StoredGroup = z.infer<typeof storedGroupSchema>;