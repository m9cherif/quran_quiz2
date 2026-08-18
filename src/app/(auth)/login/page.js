"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { setAuthStatus, setUser } from "@/store/Slices/userSlice";
import {
  advanceSignInChannel,
  getProfile,
  identify,
  sendSignInCode,
  verifySignInCode,
} from "@/lib/auth/client";
import { SIGN_IN_MESSAGE_KEYS } from "@/lib/auth/messages";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Both senders refuse a second code inside a minute — Supabase by its own
 * default, Bird Verify by its resend cooldown. Counting it down on screen is
 * kinder than letting someone press the button into a refusal. */
const RESEND_SECONDS = 60;

/**
 * Signing in is two steps: give the address, then type the code that arrives.
 *
 * A code rather than a link, because the mail is usually read on a phone while
 * the site is open on a laptop — a link opens the session on the wrong device,
 * a six-digit code can simply be typed across.
 */
export default function LoginPage() {
  const [step, setStep] = useState("email");
  const [contact, setContact] = useState("");
  /** What the typed value turned out to be — kept so the code goes to the same place. */
  const [identity, setIdentity] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /** Which way the code went — Bird picks, and it is not always SMS. */
  const [channel, setChannel] = useState(null);
  /** Set once the other channels are used up, so the offer stops being made. */
  const [noOtherWay, setNoOtherWay] = useState(false);
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
    const who = identify(contact);
    if (!who) {
      setError(t("auth.contactInvalid"));
      return;
    }
    setIdentity(who);

    setIsLoading(true);
    try {
      const result = await sendSignInCode(who);
      if (!result.ok) {
        setError(t(SIGN_IN_MESSAGE_KEYS[result.issue]));
        return;
      }
      setChannel(result.channel);
      setNoOtherWay(false);
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      console.error("Sending the sign-in code failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * "It never came." A carrier that swallowed one text will swallow the next,
   * so resending is not the answer — another channel is.
   */
  const tryAnotherWay = async () => {
    setError("");
    setIsLoading(true);
    try {
      const result = await advanceSignInChannel(identity);
      if (!result.ok) {
        if (result.issue === "no_next_channel") setNoOtherWay(true);
        setError(t(SIGN_IN_MESSAGE_KEYS[result.issue]));
        return;
      }
      setChannel(result.channel);
      // The new code skipped the cooldown, but the resend button should not:
      // it is still a send, and Bird still counts it.
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      console.error("Switching the code's channel failed:", err);
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
      const result = await verifySignInCode(identity, token);
      if (!result.ok) {
        setError(t(SIGN_IN_MESSAGE_KEYS[result.issue]));
        return;
      }

      const profile = await getProfile(result.userId);
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
        {step === "email"
          ? t("auth.codeIntro")
          : t("auth.codeSentTo", { email: identity?.value ?? contact })}
        {/* Which way it went, when that is not obvious — Bird may have used
            WhatsApp or Telegram because the text could not get through. */}
        {step === "code" && channel ? ` ${t("auth.sentByChannel", { channel })}` : ""}
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <Input
            label={t("auth.emailOrPhone")}
            type="text"
            autoComplete="username"
            placeholder={t("auth.emailOrPhonePlaceholder")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            hint={t("auth.emailOrPhoneHint")}
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
            maxLength={10}
            placeholder="••••••"
            value={code}
            // Supabase decides how long the code is — six by default, eight
            // here. Capping the field at six silently cut the last digits off
            // and every attempt failed.
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
          {identity?.channel === "phone" && !noOtherWay && (
            <button
              type="button"
              onClick={tryAnotherWay}
              disabled={isLoading}
              className="w-full text-center text-sm text-ink-muted underline-offset-2 hover:underline disabled:no-underline"
            >
              {t("auth.tryAnotherWay")}
            </button>
          )}
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
