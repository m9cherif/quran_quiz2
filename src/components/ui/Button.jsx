"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";
import Icon from "./Icon";

const SIZES = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

const VARIANTS = {
  primary:
    "bg-primary text-primary-contrast hover:bg-primary-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:hover:bg-primary",
  secondary:
    "bg-primary-soft text-primary hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  ghost:
    "bg-transparent text-ink hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  outline:
    "bg-surface border border-border text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  danger:
    "bg-danger text-white hover:bg-danger-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
};

/**
 * Button — variants: primary | secondary | ghost | outline | danger.
 *
 * Usage:
 *   <Button type="submit">Save</Button>
 *   <Button variant="danger" loading>Delete</Button>
 *   <Button href="/quizzes/new">New Quiz</Button>   // renders next/link
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className,
    href,
    icon,
    type = "button",
    ...props
  },
  ref
) {
  // `icon` takes a name from the Icon set, or a ready-made node. The spinner
  // replaces it while loading so the button does not jump width.
  const glyph = loading ? null : typeof icon === "string" ? <Icon name={icon} /> : icon ?? null;
  const classes = cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-[var(--duration-fast)]",
    SIZES[size],
    VARIANTS[variant],
    "disabled:pointer-events-none disabled:opacity-60",
    className
  );

  if (href) {
    return (
      <Link href={href} ref={ref} aria-busy={loading || undefined} className={classes} {...props}>
        {loading && <Spinner size={16} className="shrink-0" />}
        {glyph}
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading && <Spinner size={16} className="shrink-0" />}
      {glyph}
      {children}
    </button>
  );
});

export default Button;