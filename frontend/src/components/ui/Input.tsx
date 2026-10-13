"use client";
import { InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

export default function Input({ id, label, error, type, ...rest }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        style={{
          fontFamily: "Poppins, sans-serif",
          fontSize: "16px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.90)",
          lineHeight: 1,
        }}
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{
            width: "100%",
            height: "52px",
            padding: isPassword ? "0 48px 0 18px" : "0 18px",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.96)",
            border: error
              ? "1.5px solid rgba(239,68,68,0.80)"
              : "1.5px solid rgba(255,255,255,0.50)",
            fontFamily: "Poppins, sans-serif",
            fontSize: "15px",
            color: "#1a1a2e",
            outline: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
          className="placeholder-gray-400 focus:border-[#03A9F4] focus:shadow-[0_0_0_3px_rgba(3,169,244,0.20)]"
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            {showPassword ? <Eye size={19} /> : <EyeOff size={19} />}
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "12px",
            color: "#f87171",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
