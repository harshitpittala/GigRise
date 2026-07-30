"use client";

import { Button, Card, FormError, TextField } from "@gigrise/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createClient } from "../../../lib/supabase/client";
import { type SignupInput, signupSchema } from "../../../lib/validations/auth";

/**
 * Signup screen — DESIGN_SYSTEM.md §19.1 / AUTHENTICATION.md §2 steps 2-4.
 *
 * Role is collected as a plain field on this single form (not a separate
 * "Choose Role" page) — the full multi-step onboarding flow implied by
 * ARCHITECTURE.md's journey is Phase 4 territory; this phase only needs
 * the role value to exist so it can be passed through, per §2 step 3-4:
 * "role captured client-side... passed through the signup call's
 * options.data" so the (still-blocked, P1-T3) profile-sync trigger can
 * read it when it creates the public.users row.
 *
 * Supabase's own signUp() returns a session immediately (§2 step 3:
 * "logged in before email is verified" is preserved), so this redirects to
 * "/" the same as login — again a placeholder destination.
 */
export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { role: values.role } },
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-heading-xl font-weight-semibold text-text-heading">Sign up</h1>
          <p className="text-body-md text-text-body">Create your GigRise account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-body-sm font-weight-medium text-text-heading">I am a...</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-body-md text-text-body">
                <input type="radio" value="talent" {...register("role")} />
                Talent / Creator
              </label>
              <label className="flex items-center gap-2 text-body-md text-text-body">
                <input type="radio" value="hirer" {...register("role")} />
                Brand / Casting Director
              </label>
            </div>
            <FormError>{errors.role?.message}</FormError>
          </fieldset>

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            helperText="At least 10 characters, one number, one symbol"
            error={errors.password?.message}
            {...register("password")}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <FormError>{formError}</FormError>
          <Button type="submit" isLoading={isSubmitting} className="mt-2">
            Sign up
          </Button>
        </form>

        <p className="text-center text-body-sm text-text-body">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-500 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </Card>
  );
}
