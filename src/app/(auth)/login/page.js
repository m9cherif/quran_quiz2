"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { setAuthStatus, setUser } from "@/store/Slices/userSlice";
import { getProfile, sendSignInCode, verifySignInCode } from "@/lib/auth/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Long enough that a slow inbox is not a reason to ask for a second mail. */
const RESEND_SECONDS = 45;

/**
 * Signing in is two steps: give the address, then type the code that arrives.
 *
 * A code rather than a link, because the mail is usually read on a phone while
 * the site is open on a laptop — a link opens the session on the wrong device,
 * a six-digit code can simply be typed across.
 */
export default function LoginPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Straight to the code box: the address has just been typed, and retyping is
  // not the next thing anyone wants to do.
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const requestCode = async (e) => {
    e?.preventDefault();
    setError("");
    if (!isSupabaseConfigured()) {
      setError(t("auth.notConfigured"));
      return;
    }
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    setIsLoading(true);
    try {
      const { error: sendError } = await sendSignInCode(address);
      if (sendError) {
        const message = sendError.message ?? "";
        // Supabase refuses to create an account here, which is how an unknown
        // address announces itself. Say so plainly instead of repeating the
        // API's wording.
        setError(
          /signups not allowed|not found|no user/i.test(message)
            ? t("auth.noAccountForEmail")
            : /rate|limit|seconds/i.test(message)
              ? t("auth.tooManyCodes")
              : message || t("auth.couldNotSignIn")
        );
        return;
      }
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      console.error("Sending the sign-in code failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError(t("auth.codeTooShort"));
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: verifyError } = await verifySignInCode(email.trim().toLowerCase(), token);
      if (verifyError || !data?.user) {
        setError(
          /expired/i.test(verifyError?.message ?? "")
            ? t("auth.codeExpired")
            : t("auth.codeWrong")
        );
        return;
      }

      const profile = await getProfile(data.user.id);
      if (profile) dispatch(setUser(profile));
      dispatch(setAuthStatus("authenticated"));
      router.push(profile?.role === "host" ? "/host/quizzes" : "/student/dashboard");
    } catch (err) {
      console.error("Verifying the sign-in code failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">{t("auth.welcomeBack")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {step === "email" ? t("auth.codeIntro") : t("auth.codeSentTo", { email })}
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <Input
            label={t("auth.email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={isLoading} icon="send">
            {t("auth.sendCode")}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-6 space-y-4">
          <Input
            ref={codeRef}
            label={t("auth.codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-[0.4em]"
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={isLoading} icon="check">
            {t("auth.signIn")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="text-ink-muted underline-offset-2 hover:underline"
            >
              {t("auth.changeEmail")}
            </button>
            <button
              type="button"
              onClick={requestCode}
              disabled={cooldown > 0 || isLoading}
              className="text-primary underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
            >
              {cooldown > 0 ? t("auth.resendIn", { seconds: cooldown }) : t("auth.resendCode")}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </Card>
  );
}
