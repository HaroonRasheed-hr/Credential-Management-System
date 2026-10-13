"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { loadSession } from "@/lib/auth";

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!values.password) {
    errors.password = "Password is required";
  }
  return errors;
}

export default function LoginForm() {
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading, login } = useAuth();

  // Already signed in — skip the login screen.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
      if (apiError) setApiError(null);
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setApiError(null);

    const result = await login(form.email, form.password);

    if (result.ok) {
      // Developers have no Dashboard — land them on Projects instead.
      const role = loadSession()?.role;
      router.push(role === "Developer" ? "/dashboard/projects" : "/dashboard");
      return;
    }

    setIsLoading(false);

    if (result.error === "account_locked") {
      const mins = result.retryAfter ? Math.ceil(result.retryAfter / 60) : 5;
      setApiError(`Account locked. Too many failed attempts. Try again in ${mins} minute(s).`);
      return;
    }

    if (result.error === "network_error") {
      setApiError(result.message ?? "Cannot reach the server. Please try again.");
      return;
    }

    // invalid_password / user_not_found — keep message vague for security
    setErrors((prev) => ({ ...prev, password: "Incorrect email or password" }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Login form"
      className="flex flex-col gap-6"
    >
      <Input
        id="email"
        type="email"
        label="Email"
        placeholder="username@gmail.com"
        autoComplete="email"
        value={form.email}
        onChange={handleChange("email")}
        error={errors.email}
      />

      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange("password")}
          error={errors.password}
        />
      </div>

      {apiError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.45)",
          }}
        >
          <p style={{ fontFamily: "Poppins", fontSize: "13px", color: "#f87171", margin: 0 }}>
            {apiError}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        aria-label="Sign in"
        className="disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:brightness-90"
        style={{
          width: "100%",
          height: "50px",
          borderRadius: "10px",
          background: "rgba(87, 200, 231, 1)",
          fontFamily: "Poppins",
          fontWeight: 700,
          fontSize: "16px",
          color: "#0f172a",
          border: "none",
          cursor: "pointer",
          marginTop: "8px",
        }}
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </button>

      <p
        className="text-center text-gray-300"
        style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px" }}
      >
        Accounts are provisioned by an administrator. Contact your team admin
        for access.
      </p>
    </form>
  );
}
