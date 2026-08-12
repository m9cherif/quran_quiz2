"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { setAuthStatus, setUser } from "@/store/Slices/userSlice";
import { getProfile, signInWithEmail } from "@/lib/auth/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured()) {
      setError(t("auth.notConfigured"));
      return;
    }
    setIsLoading(true);

    try {
      const { data, error: authError } = await signInWithEmail(email.trim(), password);
      if (authError || !data.user) {
        setError(
          /invalid|credential/i.test(authError?.message ?? "")
            ? t("auth.invalidCredentials")
            : authError?.message ?? t("auth.couldNotSignIn")
        );
        return;
      }

      const profile = await getProfile(data.user.id);
      if (profile) dispatch(setUser(profile));
      dispatch(setAuthStatus("authenticated"));
      router.push(profile?.role === "host" ? "/host/quizzes" : "/student/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">{t("auth.welcomeBack")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("auth.logInSub")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
          autoComplete="current-password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
        />
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          {t("auth.signIn")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t("auth.signUp")}
        </Link>
      </p>
    </Card>
  );
}