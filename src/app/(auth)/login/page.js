"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { setUser } from "@/store/Slices/userSlice";
import API_CONFIG from "@/app/components/API";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.login}`;

    try {
      const response = await fetch(END_POINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (response.ok && responseData?.user_id) {
        dispatch(setUser(responseData));
        router.push("/host/games");
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">Sign in to your account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Hosts and registered students sign in here.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
        />
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Not registered yet?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}