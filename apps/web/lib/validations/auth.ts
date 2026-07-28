import { z } from "zod";

/**
 * AUTHENTICATION.md §3 (Login Flow) validates credentials against Supabase
 * itself — this schema only enforces presence/shape client-side before the
 * request is ever sent, per MASTER_DEVELOPMENT_GUIDE.md's Zod-at-every-
 * boundary rule. No password policy is re-checked here for login (an
 * existing account may predate a policy change).
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * AUTHENTICATION.md §10.1 Password Rules (verbatim): "Minimum 10
 * characters, one number, one symbol." `role` mirrors §2 step 2 ("Choose
 * Role → talent or hirer") and step 3 ("captured client-side during the
 * 'Choose Role' step and passed through the signup call's options.data").
 */
export const signupSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/\d/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    role: z.enum(["talent", "hirer"], { message: "Choose an account type" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
