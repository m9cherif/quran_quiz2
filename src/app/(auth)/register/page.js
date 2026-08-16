"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { setAuthStatus, setUser } from "@/store/Slices/userSlice";
import { getProfile, identify, sendSignInCode, verifySignInCode } from "@/lib/auth/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ROLES = [
  { value: "host", label: "auth.iAmHost", description: "auth.hostDescription" },
  { value: "student", label: "auth.iAmStudent", description: "auth.studentDescription" },
];

const RESEND_SECONDS = 45;

/**
 * Creating an account: say who you are, then confirm the address with the code
 * that arrives. No password is chosen, because none is ever used to sign in.
 *
 * The account itself is still made on the server, which is what keeps the role
 * out of the browser's hands: the code only proves the address belongs to
 * whoever typed it.
 */
export default function RegisterPage() {
  const [step, setStep] = useState("details");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [identity, setIdentity] = useState(null);
  const [role, setRole] = useState("host");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const createAccount = async (e) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError(t("auth.nameTooShort"));
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          [who.channel]: who.value,
          role,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || t("auth.serverUnreachable"));
        return;
      }

      const { error: sendError } = await sendSignInCode(who);
      if (sendError) {
        // The account exists now, so this is worth saying rather than hiding:
        // they can ask for a code from the sign-in page.
        setError(t("auth.accountMadeButNoCode"));
        return;
      }
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      console.error("Signup failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setIsLoading(true);
    try {
      const { error: sendError } = await sendSignInCode(identity);
      if (sendError) setError(t("auth.tooManyCodes"));
      else setCooldown(RESEND_SECONDS);
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
      const { data, error: verifyError } = await verifySignInCode(identity, token);
      if (verifyError || !data?.user) {
        setError(t("auth.codeWrong"));
        return;
      }

      toast({
        title: t("auth.accountCreatedTitle"),
        description: t("auth.accountCreatedDesc"),
        variant: "success",
      });
      const profile = await getProfile(data.user.id);
      if (profile) dispatch(setUser(profile));
      dispatch(setAuthStatus("authenticated"));
      router.push(profile?.role === "host" ? "/host/quizzes" : "/student/dashboard");
    } catch (err) {
      console.error("Verifying the code failed:", err);
      setError(t("auth.serverUnreachable"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">{t("auth.createAccount")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {step === "details"
          ? t("auth.registerSub")
          : t("auth.codeSentTo", { email: identity?.value ?? contact })}
      </p>

      {step === "details" ? (
        <form onSubmit={createAccount} className="mt-6 space-y-5">
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
            label={t("auth.emailOrPhone")}
            type="text"
            required
            autoComplete="username"
            placeholder={t("auth.emailOrPhonePlaceholder")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            hint={t("auth.emailOrPhoneHint")}
            error={error || undefined}
          />
          <Button type="submit" loading={isLoading} className="w-full" size="lg" icon="send">
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
            {t("auth.signUp")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setError("");
              }}
              className="text-ink-muted underline-offset-2 hover:underline"
            >
              {t("auth.changeEmail")}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || isLoading}
              className="text-primary underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
            >
              {cooldown > 0 ? t("auth.resendIn", { seconds: cooldown }) : t("auth.resendCode")}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </Card>
  );
}
