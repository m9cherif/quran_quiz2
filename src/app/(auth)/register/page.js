"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import API_CONFIG from "@/app/components/API";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.signup}`;

    try {
      const response = await fetch(END_POINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });

      const responseData = await response.json();

      if (response.ok) {
        setRegistered(true);
        toast({
          title: "Account created",
          description: "You can now sign in.",
          variant: "success",
        });
      } else {
        setError(responseData?.detail || "Could not create the account. Try a different email.");
      }
    } catch (err) {
      console.error("Signup failed:", err);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (registered) {
    return (
      <Card padding="lg" className="w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success-strong">
          <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-ink">Account created</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in with your new account to start hosting quizzes.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
        >
          Go to sign in
        </Link>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Register to host quizzes and review past games.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Input
          label="Full name"
          required
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Minimum 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 6 characters."
        />
        <Input
          label="Confirm password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={error || undefined}
        />
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}