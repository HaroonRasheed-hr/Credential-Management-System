import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/login/LoginForm";

export const metadata: Metadata = {
  title: "Login – xis.ai",
  description: "Sign in to your xis.ai account",
};

export default function LoginPage() {
  return (
    <main
      className="login-main"
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(180deg, #212121 0%, #000000 100%)",
      }}
    >
      {/* Responsive overrides (inline styles can't host media queries) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 768px) {
              .login-main {
                flex-direction: column !important;
                height: auto !important;
                min-height: 100vh !important;
                overflow: auto !important;
              }
              .login-left {
                flex: 0 0 auto !important;
                padding: 32px 24px 0 24px !important;
              }
              .login-illustration {
                display: none !important;
              }
              .login-right {
                flex: 1 1 auto !important;
                padding: 24px !important;
              }
              .login-card {
                padding: 36px 24px !important;
              }
            }
          `,
        }}
      />

      {/* ── Left panel: branding + illustration ── */}
      <div
        className="login-left"
        style={{
          flex: "1 1 0",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: "48px 0 0 56px",
          overflow: "hidden",
        }}
      >
        {/* XIS logo */}
        <div style={{ width: "128px", height: "47px", position: "relative", flexShrink: 0 }}>
          <Image
            src="/images/xis-logo.png"
            alt="xis.ai logo"
            fill
            style={{ objectFit: "contain", objectPosition: "left center" }}
            priority
          />
        </div>

        {/* Tagline */}
        <p
          style={{
            marginTop: "18px",
            fontSize: "20px",
            lineHeight: "100%",
            color: "rgba(255, 255, 255, 1)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "Poppins", fontWeight: 600 }}>Precision Beyond </span>
          <span style={{ fontFamily: "Poppins", fontWeight: 400 }}>Perception</span>
        </p>

        {/* Illustration — fills remaining height, stays within panel */}
        <div
          className="login-illustration"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            top: "140px",
          }}
        >
          <Image
            src="/images/login-illustration.png"
            alt="3D isometric analytics illustration"
            fill
            style={{ objectFit: "contain", objectPosition: "center bottom" }}
            priority
          />
        </div>
      </div>

      {/* ── Right panel: login card ── */}
      <div
        className="login-right"
        style={{
          flex: "0 0 52%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 56px 40px 32px",
        }}
      >
        <div
          className="login-card"
          style={{
            width: "100%",
            maxWidth: "580px",
            borderRadius: "20px",
            border: "2px solid rgba(255, 255, 255, 0.28)",
            background: "rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow: "0px 4px 4px 0px rgba(0, 0, 0, 0.25)",
            padding: "64px 60px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "36px",
              lineHeight: "100%",
              color: "rgba(255, 255, 255, 1)",
              margin: 0,
            }}
          >
            Login
          </h1>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
