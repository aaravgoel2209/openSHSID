import { useState, useContext, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@heroui/react/button";
import { AuthContext } from "../context/authContext";

const bgImages = [
  new URL("../assets/background/bg-1.webp", import.meta.url).href,
  new URL("../assets/background/bg-2.webp", import.meta.url).href,
  new URL("../assets/background/bg-3.webp", import.meta.url).href,
  new URL("../assets/background/bg-4.webp", import.meta.url).href,
  new URL("../assets/background/bg-5.webp", import.meta.url).href,
  new URL("../assets/background/bg-6.webp", import.meta.url).href,
  new URL("../assets/background/bg-7.webp", import.meta.url).href,
];

const translations = {
  en: {
    heading: "Hello, I am Rei",
    subheading: "Your Intelligent Assistant",
    title: "Log in",
    usernameLabel: "Username",
    usernamePlaceholder: "Please Enter the School ID Number",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter the Password",
    remember: "Remember Username",
    forgot: "Forgot Password?",
    loginBtn: "Log in",
    noAccount: "Don't have an account?",
    signUp: "Sign Up",
    logging: "Logging in...",
    error: "Login failed. Please check your credentials.",
    emptyUsername: "Username cannot be empty",
  },
  zh: {
    heading: "你好，我是Rei",
    subheading: "你的智能助手~",
    title: "登录",
    usernameLabel: "用户名",
    usernamePlaceholder: "请输入学号",
    passwordLabel: "密码",
    passwordPlaceholder: "输入密码",
    remember: "记住用户名",
    forgot: "忘记密码？",
    loginBtn: "登录",
    noAccount: "还没有账号？",
    signUp: "注册",
    logging: "登录中...",
    error: "登录失败，请检查您的凭据。",
    emptyUsername: "用户名不能为空",
  },
};

function GlobeIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="w-[20px] h-[20px] shrink-0 text-blue-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-[20px] h-[20px] shrink-0 text-blue-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AILogo() {
  return (
    <div className="relative w-full h-full" style={{ marginTop: -30 }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <path
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          fill="url(#logoGrad)"
        />
        <path
          d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          fill="url(#logoGrad)"
          opacity=".7"
        />
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function InputField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  isError,
}) {
  const inputRef = useRef(null);
  return (
    <div className="relative" style={{ height: 72 }}>
      <span className="absolute left-0 top-[-4px] text-sm text-gray-500 leading-none pointer-events-none">
        {label}
      </span>
      <div
        className="h-[48px] rounded-[10px] absolute left-0 right-0 flex items-center"
        style={{
          background: isError ? "#fef2f2" : "#eaf1fd",
          paddingLeft: 20,
          paddingRight: 20,
          top: 24,
          border: isError ? "2px solid #feabad" : "none",
          zIndex: 5,
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="shrink-0 mr-3 pointer-events-none" style={{ marginLeft: -7.5 }}>
          {icon}
        </span>
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="on"
          className="w-full bg-transparent outline-none text-[16px] min-[900px]:text-[14px] text-gray-700 placeholder-[#5b8dd9]"
          style={{ border: "none", caretColor: '#2563eb' }}
        />
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [lang, setLang] = useState("zh");
  const t = translations[lang];
  const bgUrl = useMemo(
    () => bgImages[Math.floor(Math.random() * bgImages.length)],
    [],
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [isUsernameError, setIsUsernameError] = useState(false);
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 899px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
        setIsUsernameError(false);
        setIsPasswordError(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (username || password) {
      setError("");
      setIsUsernameError(false);
      setIsPasswordError(false);
    }
  }, [username, password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsUsernameError(false);
    setIsPasswordError(false);
    setSubmitting(true);
    try {
      await login(username, password);
      if (remember) localStorage.setItem("shsid_username", username);
      else localStorage.removeItem("shsid_username");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || t.error);
      setIsUsernameError(true);
      setIsPasswordError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setError("");
    setIsUsernameError(false);
    setIsPasswordError(false);
  };

  /* ===== Mobile layout — single-column card, touch friendly ===== */
  if (isMobile) {
    return (
      <div
        className="min-h-screen w-full overflow-y-auto"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark overlay */}
        <div className="fixed inset-0 bg-black/35 pointer-events-none"></div>

        {/* Language switcher — top right, clear of the notch */}
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="absolute right-4 z-20 flex items-center gap-2 text-white bg-white/10 rounded-full px-3 py-2 border border-white/20 backdrop-blur-sm cursor-pointer"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
        >
          <GlobeIcon />
          <span className="text-xs font-semibold">
            {lang === "en" ? "EN" : "中文"}
          </span>
        </button>

        <div
          className="relative z-10 flex min-h-screen items-center justify-center px-5"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 40px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
        >
          <div
            className="w-full rounded-[16px] relative"
            style={{
              maxWidth: 400,
              background: "#ffffff",
              boxShadow: "0 12px 40px rgba(0,0,0,.18)",
              padding: "28px 22px 20px",
            }}
          >
            {/* Header — AI logo + greeting */}
            <div className="flex flex-col items-center">
              <div style={{ width: 92, height: 92 }}>
                <AILogo />
              </div>
              <h2
                className="text-[#344054] text-[18px] font-semibold leading-tight"
                style={{ marginTop: -24 }}
              >
                {t.heading}
              </h2>
              <p className="text-[14px] text-gray-400 mt-0.5">
                {t.subheading}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col w-full mt-1"
            >
              {/* Title */}
              <h1 className="text-[#344054] text-[22px] font-bold leading-tight tracking-tight text-center">
                {t.title}
              </h1>
              <div
                className="mx-auto"
                style={{
                  width: 56,
                  height: 3.5,
                  borderRadius: 999,
                  background: "#2270e3",
                  marginTop: 4,
                }}
              ></div>

              {/* Error banner — tap to dismiss */}
              {error && (
                <div
                  onClick={handleClear}
                  className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-[10px] cursor-pointer"
                  style={{ background: "#fef2f2", border: "1.5px solid #feabad" }}
                >
                  <svg
                    className="w-[16px] h-[16px] shrink-0 mt-[1px]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    style={{ color: "#ef4444" }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span
                    className="text-[13px] font-medium leading-tight"
                    style={{ color: "#dc2626" }}
                  >
                    {error}
                  </span>
                </div>
              )}

              {/* Username */}
              <div className="mt-[14px]">
                <InputField
                  label={t.usernameLabel}
                  icon={<UserIcon />}
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChange={setUsername}
                  isError={isUsernameError && !!error}
                />
              </div>

              {/* Password */}
              <div className="mt-[18px]">
                <InputField
                  label={t.passwordLabel}
                  icon={<LockIcon />}
                  type="password"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={setPassword}
                  isError={isPasswordError && !!error}
                />
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between mt-[16px] w-full">
                <div
                  className="gap-2 select-none"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                  onClick={() => {
                    if (!username) {
                      setError(t.emptyUsername);
                      setIsUsernameError(true);
                      return;
                    }
                    setRemember(!remember);
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      border: remember ? "none" : "1px solid #d1d5db",
                      borderRadius: 3,
                      backgroundColor: remember ? "#2563eb" : "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {remember && (
                      <svg viewBox="0 0 14 14" fill="none" width={12} height={12}>
                        <path
                          d="M3 7.5L5.5 10L11 4"
                          stroke="#fff"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 select-none">
                    {t.remember}
                  </span>
                </div>
                <button
                  type="button"
                  style={{ color: "#2270e3", minHeight: 32 }}
                  className="text-sm font-medium no-underline transition-colors hover:text-blue-700"
                >
                  {t.forgot}
                </button>
              </div>

              {/* Login button */}
              <div className="mt-[16px] w-full">
                <Button
                  type="submit"
                  fullWidth
                  color="primary"
                  isLoading={submitting}
                  style={{
                    height: 52,
                    fontSize: 16,
                    borderRadius: 10,
                    background: "#1f6fe5",
                    fontWeight: "bold",
                  }}
                  className="font-bold"
                >
                  {t.loginBtn}
                </Button>
              </div>

              {/* Register link */}
              <p className="text-sm text-center w-full mt-5 text-gray-400">
                {t.noAccount}{" "}
                <Link
                  to="/register"
                  style={{ color: "#2270e3" }}
                  className="font-semibold no-underline transition-colors hover:text-blue-700 ml-1"
                >
                  {t.signUp}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/35"></div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* SHSID logo floating above card */}
        {/*<img src={new URL('../assets/shsid-logo.png', import.meta.url).href} alt="SHSID" style={{ width: 528, height: 528, position: 'absolute', bottom: 'calc(100% - 200px)', left: '50%', transform: 'translateX(-50%)', zIndex: 30, objectFit: 'contain', pointerEvents: 'none' }} />*/}

        {/* === Card 870×430 (−20%) === */}
        <div
          className="w-[870px] h-[430px] rounded-[16px] overflow-hidden relative flex"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,.12)" }}
        >
          {/* Vertical separator */}
          <div
            className="absolute left-[39%] top-0 bottom-0 z-20 pointer-events-none w-[1px]"
            style={{ background: "rgba(255,255,255,.35)" }}
          ></div>

          {/* ===== LEFT PANEL 39% — precision frosted acrylic over glass === */}
          <div className="w-[39%] relative" style={{
            background: "radial-gradient(ellipse at 40% 15%, rgba(232,240,252,.93) 0%, rgba(222,230,245,.90) 20%, rgba(212,222,240,.88) 40%, rgba(200,212,234,.86) 60%, rgba(190,204,228,.84) 80%, rgba(182,196,224,.82) 100%)",
            backdropFilter: "blur(100px) saturate(1.2) brightness(0.98)",
            boxShadow: "inset 0 0 40px rgba(255,255,255,.04), inset 0 0 80px rgba(180,200,230,.03)",
          }}>
            {/* Upper-left light source — soft glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 25%, transparent 55%)",
            }}></div>

            {/* Vertical diffusion streaks — milky light distribution */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, rgba(255,255,255,.015) 0px, transparent 1px, transparent 4px, rgba(255,255,255,.008) 4px, transparent 5px, transparent 8px),
                repeating-linear-gradient(0deg, rgba(255,255,255,.01) 0px, transparent 2px, transparent 6px, rgba(255,255,255,.006) 6px, transparent 7px, transparent 12px)
              `,
              backgroundSize: '100% 12px, 100% 20px',
            }}></div>

            {/* Microscopic square mesh — etched into material (3×3px) */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `
                repeating-linear-gradient(90deg, rgba(160,180,210,.018) 0px, rgba(160,180,210,.018) 1px, transparent 1px, transparent 3px),
                repeating-linear-gradient(0deg, rgba(160,180,210,.018) 0px, rgba(160,180,210,.018) 1px, transparent 1px, transparent 3px)
              `,
            }}></div>

            {/* Halftone micro-dot texture — fabric-like */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `radial-gradient(circle at 0.5px 0.5px, rgba(150,175,210,.012) 0.3px, transparent 0.5px)`,
              backgroundSize: '2px 2px',
            }}></div>

            {/* Low-contrast noise — grain */}
            <div className="absolute inset-0 pointer-events-none" style={{
              opacity: 0.008,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
            }}></div>

            {/* Edge density — darker borders (material thickness) */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `
                radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(140,160,190,.04) 75%, rgba(130,150,180,.06) 95%),
                linear-gradient(0deg, rgba(120,145,175,.03) 0%, transparent 15%),
                linear-gradient(180deg, rgba(120,145,175,.02) 0%, transparent 15%),
                linear-gradient(90deg, rgba(120,145,175,.02) 0%, transparent 10%),
                linear-gradient(-90deg, rgba(120,145,175,.02) 0%, transparent 10%)
              `,
            }}></div>

            {/* Cloudy center diffusion — slight milky opacity */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at 45% 40%, rgba(255,255,255,.05) 0%, rgba(200,215,238,.02) 40%, transparent 70%)",
            }}></div>

            {/* Ghosted watermark — bottom-right corner, half covered */}
            <img
              src={new URL("../assets/shsid-logo.png", import.meta.url).href}
              alt=""
              className="absolute pointer-events-none"
              style={{
                width: 120,
                height: 120,
                right: -30,
                bottom: -30,
                opacity: 0.035,
                objectFit: 'contain',
                filter: 'blur(2px)',
              }}
            />

            {/* Top edge — thin light capture */}
            <div className="absolute inset-x-0 top-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.06) 30%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.06) 70%, transparent)" }}></div>

            {/* Bottom edge — thin shadow */}
            <div className="absolute inset-x-0 bottom-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(100,125,155,.04) 30%, rgba(100,125,155,.06) 50%, rgba(100,125,155,.04) 70%, transparent)" }}></div>

            {/* Left edge — light piping */}
            <div className="absolute inset-y-4 left-0 w-[1px]" style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,.04) 30%, rgba(255,255,255,.06) 50%, rgba(255,255,255,.04) 70%, transparent)" }}></div>

            {/* Right edge — slight shadow */}
            <div className="absolute inset-y-4 right-0 w-[1px]" style={{ background: "linear-gradient(180deg, transparent, rgba(100,125,155,.02) 30%, rgba(100,125,155,.04) 50%, rgba(100,125,155,.02) 70%, transparent)" }}></div>

            {/* Bottom-right corner radius transmission — light leak */}
            <div className="absolute bottom-0 right-0 w-[60px] h-[60px] pointer-events-none" style={{
              background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,.02) 0%, transparent 70%)",
            }}></div>

            {/* Top-left corner bright spot */}
            <div className="absolute top-0 left-0 w-[80px] h-[80px] pointer-events-none" style={{
              background: "radial-gradient(circle at 0% 0%, rgba(255,255,255,.06) 0%, transparent 70%)",
            }}></div>

            {/* Error speech bubble — emerges from AI with bounce animation */}
            <div
              className="absolute z-30 flex items-start gap-[5px] px-4 py-2.5 rounded-xl cursor-pointer group mx-auto"
              onClick={handleClear}
              style={{
                left: 0,
                right: 0,
                width: 180,
                justifyContent: "center",
                top: 28,
                background: error ? "#ffffff" : "transparent",
                border: error ? "2.5px solid #feabad" : "none",
                boxShadow: error ? "0 8px 24px rgba(254,171,173,.3)" : "none",
                opacity: error ? 1 : 0,
                transform: `scale(${error ? 1 : 0.7})`,
                transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Pointer — bottom pointing down to logo */}
              <div
                className="absolute -bottom-[8px] left-1/2 -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: error
                    ? "7px solid transparent"
                    : "7px solid rgba(0,0,0,0)",
                  borderRight: error
                    ? "7px solid transparent"
                    : "7px solid rgba(0,0,0,0)",
                  borderTop: error
                    ? "8px solid #feabad"
                    : "8px solid rgba(254,171,173,0)",
                }}
              ></div>

              {/* Warning triangle exclamation */}
              <svg
                className={`w-[16px] h-[16px] shrink-0 mt-[2px] transition-all`}
                fill="currentColor"
                viewBox="0 0 20 20"
                style={{
                  opacity: error ? 1 : 0,
                  transform: `scale(${error ? 1 : 0.4})`,
                  color: "#ef4444",
                  transitionDelay: "50ms",
                }}
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>

              {/* Error text */}
              <span
                className={`text-[13px] font-medium leading-tight select-none`}
                style={{
                  color: error ? "#dc2626" : "transparent",
                  opacity: error ? 1 : 0,
                  transform: `translateY(${error ? 0 : -4}px)`,
                  transition: "all 0.3s ease-out 80ms",
                }}
              >
                {error}
              </span>
            </div>

            {/* Logo + text — compact */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-10"
              style={{ padding: "32px 24px" }}
            >
              <div style={{ width: 130, height: 130, transition: "filter 0s", filter: error ? "hue-rotate(100deg) saturate(1.8) brightness(0.75)" : "none" }}>
                <AILogo />
              </div>
              <div className="text-center" style={{ marginTop: -5 }}>
                <h2
                  className="text-white text-[20px] font-semibold leading-tight"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,.08)" }}
                >
                  {t.heading}
                </h2>
                <p className="mt-1.5 text-[17px] font-normal text-white opacity-75">
                  {t.subheading}
                </p>
              </div>
            </div>

            {/* SHSID watermark bottom-right — half covered by panel edge */}
            <img
              src={new URL("../assets/shsid-watermark.png", import.meta.url).href}
              alt="SHSID"
              className="absolute pointer-events-none"
              style={{ width: 150, height: 150, right: -50, bottom: -40, opacity: 0.8, zIndex: 40, objectFit: 'contain' }}
            />

            {/* Bottom-left language switcher */}
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="absolute left-5 bottom-[18px] z-[100] flex items-center gap-2 text-white bg-white/10 rounded-full px-3 py-2 hover:bg-white/20 transition-all backdrop-blur-sm cursor-pointer border border-white/20"
            >
              <GlobeIcon />
              <span className="text-xs font-semibold">
                {lang === "en" ? "EN" : "中文"}
              </span>
            </button>
          </div>

          {/* ===== RIGHT PANEL 61% === */}
          <div className="w-[61%] relative" style={{ background: "#ffffff" }}>
            {/* SHSID watermark top-right */}
            <img
              src={new URL("../assets/shsid-watermark.png", import.meta.url).href}
              alt="SHSID"
              className="absolute pointer-events-none"
              style={{ width: 155, height: 155, right: -42, top: -32, opacity: 0.75, objectFit: 'contain' }}
            />

            {/* Form container — centered, fills card */}
            <div
              className="relative z-10 flex flex-col items-center"
              style={{ paddingTop: 32, paddingBottom: 24 }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  maxWidth: 420,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
                className="flex flex-col w-full"
              >
                {/* Title — centered */}
                <h1 className="text-[#344054] text-[26px] font-bold leading-tight tracking-tight mb-1 text-center">
                  {t.title}
                </h1>
                <div
                  className="mx-auto"
                  style={{
                    width: 56,
                    height: 3.5,
                    borderRadius: 999,
                    background: "#2270e3",
                    marginTop: 4,
                  }}
                ></div>

                {/* Username */}
                <div className="mt-[14px]">
                  <InputField
                    label={t.usernameLabel}
                    icon={<UserIcon />}
                    placeholder={t.usernamePlaceholder}
                    value={username}
                    onChange={setUsername}
                    isError={isUsernameError && !!error}
                  />
                </div>

                {/* Password — 24px below username */}
                <div className="mt-[24px]">
                  <InputField
                    label={t.passwordLabel}
                    icon={<LockIcon />}
                    type="password"
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={setPassword}
                    isError={isPasswordError && !!error}
                  />
                </div>

                {/* Checkbox + Forgot — 16px below password */}
                <div
                  className="flex items-center justify-between mt-[16px] w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                    className="gap-2 select-none"
                    onClick={() => {
                      if (!username) { setError(t.emptyUsername); setIsUsernameError(true); return; }
                      setRemember(!remember);
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        border: remember ? "none" : "1px solid #d1d5db",
                        borderRadius: 2,
                        backgroundColor: remember ? "#2563eb" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 4,
                      }}
                    >
                      {remember && (
                        <svg
                          viewBox="0 0 14 14"
                          fill="none"
                          width={14}
                          height={14}
                        >
                          <path
                            d="M3 7.5L5.5 10L11 4"
                            stroke="#fff"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 select-none">
                      {t.remember}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{ color: "#2270e3" }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium no-underline transition-colors hover:text-blue-700"
                  >
                    {t.forgot}
                  </button>
                </div>

                {/* Login button — thicker */}
                <div className="mt-[20px] w-full">
                  <Button
                    type="submit"
                    fullWidth
                    color="primary"
                    isLoading={submitting}
                    style={{
                      height: 52,
                      fontSize: 16,
                      borderRadius: 10,
                      background: "#1f6fe5",
                      fontWeight: "bold",
                    }}
                    className="font-bold"
                  >
                    {t.loginBtn}
                  </Button>
                </div>

                {/* Spacer pushes register link to bottom with extra gap */}
                <div style={{ minHeight: 21 }}></div>

                {/* Register link — anchored near bottom with gap from button */}
                <p className="text-sm text-center w-full mb-[15px] px-2 text-gray-400">
                  {t.noAccount}{" "}
                  <Link
                    to="/register"
                    style={{ color: "#2270e3" }}
                    className="font-semibold no-underline transition-colors hover:text-blue-700 ml-1"
                  >
                    {t.signUp}
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
