"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button } from "./button";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function ConfirmSubmitButton({
  message,
  variant = "danger",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { message: string; variant?: ButtonVariant }) {
  return (
    <Button
      type="submit"
      variant={variant}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}
