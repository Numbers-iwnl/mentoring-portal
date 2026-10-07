import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  editable = false
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  editable?: boolean;
}) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-semibold text-graphite-800">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 break-words">{label}</span>
        {editable ? <PencilLine className="shrink-0 text-champagne-700/70" size={13} aria-hidden="true" /> : null}
      </span>
      {children}
      {hint ? <span className="text-xs font-normal text-graphite-700/70">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-sm text-ink outline-none transition placeholder:text-[rgba(51,66,75,0.42)] focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-sm text-ink outline-none transition focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-[rgba(51,66,75,0.42)] focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]",
        className
      )}
      {...props}
    />
  );
}
