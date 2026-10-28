import { z } from "zod";

import { INVITE_CODE_PATTERN, normalizePersonName } from "./format";

// Schemas copied from the mobile app's utils/validation.ts.

function nameField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(/^[A-Za-z][A-Za-z\s.'-]*$/, `${label} contains invalid characters.`)
    .transform(normalizePersonName);
}

export const emailSchema = z.string().trim().min(1, "Email is required").email("Please enter a valid email address");

export const passwordSchema = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character");

const confirmPassword = z.string().min(1, "Please confirm your password");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    firstName: nameField("First name"),
    lastName: nameField("Last name"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    password: passwordSchema,
    confirmPassword,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const inviteCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      INVITE_CODE_PATTERN,
      "Invite code must be 3 letters followed by 4 alphanumeric characters (e.g. ABC-1X2Y)",
    ),
});

export const verificationCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
});

export const profileNameSchema = z.object({
  firstName: nameField("First name"),
  lastName: nameField("Last name"),
});

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Runs a schema and returns the parsed value or the first error per field. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.infer<S>; errors: null } | { data: null; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

export interface PasswordStrength {
  metChecks: number;
  label: "Poor" | "Fair" | "Good" | "Strong";
  requirements: { label: string; met: boolean }[];
  isValid: boolean;
}

/** Same rules as the mobile usePasswordStrength hook. */
export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.trim().length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const metChecks = Object.values(checks).filter(Boolean).length;
  return {
    metChecks,
    label: metChecks <= 1 ? "Poor" : metChecks === 2 ? "Fair" : metChecks === 3 ? "Good" : "Strong",
    requirements: [
      { label: "At least 8 characters", met: checks.minLength },
      { label: "Uppercase letter", met: checks.upper },
      { label: "Lowercase letter", met: checks.lower },
      { label: "Number", met: checks.number },
      { label: "Special character", met: checks.special },
    ],
    isValid: metChecks === 5,
  };
}
