"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightSlot, invalid, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-9 px-3 text-[13px] text-ink-950",
            "bg-white border rounded-lg",
            "placeholder:text-ink-400",
            "transition-colors duration-150",
            "focus:outline-none focus:border-ink-900 focus:shadow-focus",
            "disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed",
            invalid ? "border-red-300" : "border-ink-200 hover:border-ink-300",
            leftIcon && "pl-9",
            rightSlot && "pr-10",
            className
          )}
          {...props}
        />
        {rightSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface LabelProps {
  children: ReactNode;
  optional?: boolean;
  hint?: string;
  htmlFor?: string;
}

export function Label({ children, optional, hint, htmlFor }: LabelProps) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-ink-800"
      >
        {children}
        {optional && (
          <span className="ml-1.5 text-ink-400 font-normal">optional</span>
        )}
      </label>
      {hint && <span className="text-2xs text-ink-400">{hint}</span>}
    </div>
  );
}
