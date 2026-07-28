"use client";

import { Button, Card, FormError, TextField } from "@gigrise/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createClient } from "../../../lib/supabase/client";
import { type LoginInput, loginSchema } from "../../../lib/validations/auth";

/**
 * Login screen — DESIGN_SYSTEM.md §19.1 / AUTHENTICATION.md §3. Calls the
 * Supabase client SDK directly (AUTHENTICATION.md §2 step 3: "GigRise's API
 * no longer exposes a custom [auth] endpoint"). Error messages are shown
 * verbatim from Supabase for now — the AUTHENTICATION.md §17 error-envelope
 * translation layer is P1-T5, a separate still-blocked task.
 *
 * Redirects to "/" on success — a placeholder destination, since no real
 * post-login landing page (dashboard/onboarding) exists yet in this phase.
 */
export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);

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
          <h1 className="text-heading-xl font-weight-semibold text-text-heading">Log in</h1>
          <p className="text-body-md text-text-body">Welcome back to GigRise.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <FormError>{formError}</FormError>
          <Button type="submit" isLoading={isSubmitting} className="mt-2">
            Log in
          </Button>
        </form>

        <p className="text-center text-body-sm text-text-body">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-indigo-500 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </Card>
  );
}
