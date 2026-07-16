"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/** A simple spinning loader icon. */
export function Spinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />;
}

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Optional label shown while pending (defaults to keeping children). */
  pendingLabel?: React.ReactNode;
  spinnerSize?: number;
};

/**
 * Submit button that shows a spinner while its enclosing <form>'s server action
 * is running. Must be rendered inside a <form action={...}> (useFormStatus reads
 * that form's pending state). A trailing spinner is appended while pending and the
 * button is disabled to prevent double-submits.
 */
export function SubmitButton({
  children, pendingLabel, spinnerSize = 14, disabled, style, ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      style={{ ...style, opacity: pending ? 0.7 : style?.opacity }}
      {...rest}
    >
      {pending ? (pendingLabel ?? children) : children}
      {pending && <Spinner size={spinnerSize} className="shrink-0" />}
    </button>
  );
}
