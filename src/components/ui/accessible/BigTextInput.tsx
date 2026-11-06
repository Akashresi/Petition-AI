import React from "react";

interface BigTextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function BigTextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  helperText,
  error,
  multiline = false,
  rows = 4,
  type = "text",
  required = false,
  disabled = false,
  className = "",
}: BigTextInputProps) {
  const baseClasses = `
    w-full min-h-[48px] px-4 py-3 text-lg sm:text-xl font-medium rounded-xl
    border-2 transition-colors select-text
    text-slate-900 bg-white placeholder-slate-400
    dark:text-slate-100 dark:bg-slate-900 dark:placeholder-slate-500
    focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800
    disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed
    ${error ? "border-rose-700 bg-rose-50/30" : "border-slate-600 dark:border-slate-400"}
  `;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label
        htmlFor={id}
        className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between"
      >
        <span>
          {label} {required && <span className="text-rose-700" aria-hidden="true">*</span>}
        </span>
      </label>

      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-help` : undefined}
          className={`${baseClasses} resize-y leading-relaxed`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-help` : undefined}
          className={baseClasses}
        />
      )}

      {error ? (
        <p id={`${id}-error`} className="text-base sm:text-lg font-bold text-rose-800 dark:text-rose-300">
          ⚠️ {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-base text-slate-600 dark:text-slate-300">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

