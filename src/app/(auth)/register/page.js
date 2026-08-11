"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { signInWithEmail } from "@/lib/auth/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ROLES = [
  { value: "host", label: "auth.iAmHost", description: "auth.hostDescription" },
  { value: "student", label: "auth.iAmStudent", description: "auth.studentDescription" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("host");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError(t("auth.nameTooShort"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password, role }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || t("auth.serverUnreachable"));
        return;
      }

      toast({
        title: t("auth.accountCreatedTitle"),
        description: t("auth.accountCreatedDesc"),
        variant: "success",
      });

      const { error: signInError } = await signInWithEmail(email.trim(), password);
      if (signInError) {
        router.push("/login");
        return;
      }
      router.push(role === "host" ? "/host/games" : "/");
    } catch (err) {
      console.error("Signup failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">{t("auth.createAccount")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("auth.registerSub")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("auth.accountType")}</legend>
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                  role === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:border-primary"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{t(option.label)}</span>
                  <span className="block text-xs text-ink-muted">{t(option.description)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          label={t("auth.name")}
          required
          autoComplete="name"
          placeholder={t("auth.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t("auth.email")}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={t("auth.password")}
          type="password"
          required
          autoComplete="new-password"
          placeholder={t("auth.minCharsHint")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t("auth.minCharsHint")}
        />
        <Input
          label={t("auth.confirmPassword")}
          type="password"
          required
          autoComplete="new-password"
          placeholder={t("auth.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={error || undefined}
        />
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          {t("auth.signUp")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </Card>
  );
}