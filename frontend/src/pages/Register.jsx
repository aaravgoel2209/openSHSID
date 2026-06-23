import { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { AuthContext } from '../context/AuthContext';

const bgImages = [
  new URL('../assets/background/bg-1.png', import.meta.url).href,
  new URL('../assets/background/bg-2.png', import.meta.url).href,
  new URL('../assets/background/bg-3.png', import.meta.url).href,
  new URL('../assets/background/bg-4.png', import.meta.url).href,
  new URL('../assets/background/bg-5.png', import.meta.url).href,
  new URL('../assets/background/bg-6.png', import.meta.url).href,
  new URL('../assets/background/bg-7.png', import.meta.url).href,
];

const translations = {
  en: {
    heading: 'Hello, I am Rei',
    subheading: 'Your Intelligent Assistant',
    title: 'Create Account',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Choose a Username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Set Password',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Enter Password Again',
    signUpBtn: 'Sign Up',
    hasAccount: 'Already have an account?',
    logIn: 'Log In',
    registering: 'Creating...',
    passwordsMismatch: 'Passwords do not match.',
    errorGeneral: 'Registration failed. Please try again.',
  },
  zh: {
    heading: '你好，我是Rei',
    subheading: '你的智能助手~',
    title: '创建账号',
    usernameLabel: '用户名',
    usernamePlaceholder: '选择一个用户名',
    passwordLabel: '密码',
    passwordPlaceholder: '设置密码',
    confirmPasswordLabel: '确认密码',
    confirmPasswordPlaceholder: '再次输入密码',
    signUpBtn: '注册',
    hasAccount: '已有账号？',
    logIn: '登录',
    registering: '创建中...',
    passwordsMismatch: '两次密码不一致。',
    errorGeneral: '注册失败，请重试。',
  },
};

function GlobeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-[20px] h-[20px] shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-[20px] h-[20px] shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AILogo() {
  return (
    <div className="relative w-full h-full" style={{ marginTop: -30 }}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" fill="url(#logoGrad)" />
        <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" fill="url(#logoGrad)" opacity=".7" />
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

function InputField({ label, icon, placeholder, value, onChange, type = 'text', isError }) {
  const inputRef = useRef(null);
  return (
    <div className="relative" style={{ height: 72 }}>
      <span className="absolute left-0 top-[-4px] text-sm text-gray-500 leading-none pointer-events-none">{label}</span>
      <div className="h-[48px] rounded-[10px] absolute left-0 right-0 flex items-center" style={{ background: isError ? '#fef2f2' : '#eaf1fd', paddingLeft: 20, paddingRight: 20, top: 24, border: isError ? '2px solid #feabad' : 'none', cursor: 'text' }} onClick={() => inputRef.current?.focus()}>
        <span className="shrink-0 mr-3 pointer-events-none" style={{ marginLeft: -7.5 }}>{icon}</span>
        <input ref={inputRef} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={150}
               className="w-full bg-transparent outline-none text-[14px] text-gray-700 placeholder-[#5b8dd9]" style={{ border: 'none' }} />
      </div>
    </div>
  );
}

const djangoErrors = {
  en: {},
  zh: {
    'This field may not be blank.': '此字段不能为空。',
    'A user with that username already exists.': '该用户名已被注册。',
    'This password is too short. It must contain at least 8 characters.': '密码太短，至少需要8个字符。',
    'This password is too common.': '密码过于常见。',
    'This password is entirely numeric.': '密码不能为纯数字。',
    'Enter a valid username. This value may contain only letters, numbers, and @/./+/-/_ characters.': '用户名只能包含字母、数字和 @/./+/-/_ 字符。',
  },
};

function translateErr(msg, lang) {
  if (lang === 'zh' && djangoErrors.zh[msg]) return djangoErrors.zh[msg];
  return msg;
}

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [lang, setLang] = useState('zh');
  const t = translations[lang];
  const bgUrl = useMemo(() => bgImages[Math.floor(Math.random() * bgImages.length)], []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [isUsernameError, setIsUsernameError] = useState(false);
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [isPassword2Error, setIsPassword2Error] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
        setIsUsernameError(false);
        setIsPasswordError(false);
        setIsPassword2Error(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (username || password || password2) {
      setError('');
      setIsUsernameError(false);
      setIsPasswordError(false);
      setIsPassword2Error(false);
    }
  }, [username, password, password2]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUsernameError(false);
    setIsPasswordError(false);
    setIsPassword2Error(false);
    if (password !== password2) {
      setError(t.passwordsMismatch);
      setIsPassword2Error(true);
      return;
    }
    setSubmitting(true);
    try {
      await register(username, password);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = [];
        Object.values(data).forEach((arr) => {
          const items = Array.isArray(arr) ? arr : [arr];
          items.forEach((m) => msgs.push(translateErr(m, lang)));
        });
        setError(msgs.join(' ') || t.errorGeneral);
      } else {
        setError(t.errorGeneral);
      }
      setIsUsernameError(true);
      setIsPasswordError(true);
      setIsPassword2Error(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setError('');
    setIsUsernameError(false);
    setIsPasswordError(false);
    setIsPassword2Error(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden"
         style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/35"></div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <img src={new URL('../assets/shsid-logo.png', import.meta.url).href} alt="SHSID" style={{ width: 528, height: 528, position: 'absolute', bottom: 'calc(100% - 215px)', left: '50%', transform: 'translateX(-50%)', zIndex: 30, objectFit: 'contain' }} />
        <div className="w-[870px] h-[510px] rounded-[16px] overflow-hidden relative flex" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>

          <div className="absolute left-[39%] top-0 bottom-0 z-20 pointer-events-none w-[1px]" style={{ background: 'rgba(255,255,255,.35)' }}></div>

          {/* ===== LEFT PANEL 39% — premium acrylic plaque === */}
          <div className="w-[39%] relative" style={{
            background: 'linear-gradient(165deg, rgba(240,244,250,.88) 0%, rgba(228,234,246,.82) 20%, rgba(218,224,238,.78) 40%, rgba(208,216,232,.75) 60%, rgba(198,210,228,.72) 80%, rgba(190,204,222,.70) 100%)',
            backdropFilter: 'blur(80px) saturate(1.6) brightness(1.03)',
          }}>
            {/* Micro grid texture */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(180,195,215,.03) 0px, rgba(180,195,215,.03) 1px, transparent 1px, transparent 2px), repeating-linear-gradient(0deg, rgba(180,195,215,.03) 0px, rgba(180,195,215,.03) 1px, transparent 1px, transparent 2px)',
            }}></div>

            {/* Noise grain */}
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.02, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")` }}></div>

            {/* Bevels */}
            <div className="absolute inset-x-0 top-0 h-[1px]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,.35), rgba(255,255,255,.6) 50%, rgba(255,255,255,.35))' }}></div>
            <div className="absolute inset-x-0 top-[1px] h-[2px]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,.15), rgba(255,255,255,.3) 50%, rgba(255,255,255,.15))' }}></div>
            <div className="absolute inset-x-0 bottom-0 h-[1px]" style={{ background: 'linear-gradient(90deg, rgba(80,100,130,.08), rgba(80,100,130,.15) 50%, rgba(80,100,130,.08))' }}></div>
            <div className="absolute inset-x-0 bottom-[1px] h-[2px]" style={{ background: 'linear-gradient(90deg, rgba(60,80,110,.04), rgba(60,80,110,.08) 50%, rgba(60,80,110,.04))' }}></div>
            <div className="absolute inset-y-0 left-0 w-[1px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.35) 40%, rgba(255,255,255,.2))' }}></div>
            <div className="absolute inset-y-0 right-0 w-[1px]" style={{ background: 'linear-gradient(180deg, rgba(60,80,110,.04), rgba(60,80,110,.08) 50%, rgba(60,80,110,.04))' }}></div>

            {/* Inner shadow */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset -2px -2px 8px rgba(60,80,110,.03), inset 2px 2px 4px rgba(255,255,255,.1)' }}></div>

            {/* Caustics */}
            <div className="absolute top-[-60px] left-[40%] w-[200px] h-[500px]" style={{ transform: 'rotate(18deg)', background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,.06) 45%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.06) 55%, transparent 70%)', pointerEvents: 'none' }}></div>
            <div className="absolute top-[30%] left-[10%] w-[120px] h-[350px]" style={{ transform: 'rotate(-8deg)', background: 'linear-gradient(90deg, transparent 40%, rgba(255,255,255,.03) 50%, transparent 60%)', pointerEvents: 'none' }}></div>

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 50%, transparent 40%, rgba(180,200,225,.04) 100%)' }}></div>

            {/* Error speech bubble */}
            <div className="absolute z-30 flex items-start gap-[5px] px-4 py-2.5 rounded-xl cursor-pointer group mx-auto" onClick={handleClear}
                 style={{ left: 0, right: 0, width: 220, justifyContent: 'center', top: 28, background: error ? '#ffffff' : 'transparent', border: error ? '2.5px solid #feabad' : 'none', boxShadow: error ? '0 8px 24px rgba(254,171,173,.3)' : 'none', opacity: error ? 1 : 0, transform: `scale(${error ? 1 : 0.7})`, transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="absolute -bottom-[8px] left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: error ? '7px solid transparent' : '7px solid rgba(0,0,0,0)', borderRight: error ? '7px solid transparent' : '7px solid rgba(0,0,0,0)', borderTop: error ? '8px solid #feabad' : '8px solid rgba(254,171,173,0)' }}></div>
              <svg className="w-[16px] h-[16px] shrink-0 mt-[2px] transition-all" fill="currentColor" viewBox="0 0 20 20" style={{ opacity: error ? 1 : 0, transform: `scale(${error ? 1 : 0.4})`, color: '#ef4444', transitionDelay: '50ms' }}>
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-[13px] font-medium leading-tight select-none" style={{ color: error ? '#dc2626' : 'transparent', opacity: error ? 1 : 0, transform: `translateY(${error ? 0 : -4}px)`, transition: 'all 0.3s ease-out 80ms' }}>{error}</span>
            </div>

            {/* Logo + text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ padding: '32px 24px' }}>
              <div style={{ width: 130, height: 130, transition: 'filter 0s', filter: error ? 'hue-rotate(100deg) saturate(1.8) brightness(0.75)' : 'none' }}>
                <AILogo />
              </div>
              <div className="text-center" style={{ marginTop: -5 }}>
                <h2 className="text-white text-[20px] font-semibold leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,.08)' }}>{t.heading}</h2>
                <p className="mt-1.5 text-[17px] font-normal text-white opacity-75">{t.subheading}</p>
              </div>
            </div>

            {/* Language switcher */}
            <button type="button" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
                    className="absolute left-5 bottom-[18px] z-[100] flex items-center gap-2 text-white bg-white/10 rounded-full px-3 py-2 hover:bg-white/20 transition-all backdrop-blur-sm cursor-pointer border border-white/20">
              <GlobeIcon />
              <span className="text-xs font-semibold">{lang === 'en' ? 'EN' : '中文'}</span>
            </button>
          </div>

          {/* ===== RIGHT PANEL 61% === */}
          <div className="w-[61%] relative" style={{ background: '#ffffff' }}>
            {/* SHSID watermark top-right */}
            <img
              src={new URL("../assets/shsid-watermark.png", import.meta.url).href}
              alt="SHSID"
              className="absolute pointer-events-none"
              style={{ width: 155, height: 155, right: -42, top: -32, opacity: 0.75, objectFit: 'contain' }}
            />

            {/* Form container */}
            <div className="relative z-10 flex flex-col items-center" style={{ paddingTop: 32, paddingBottom: 24 }}>
              <form onSubmit={handleSubmit} style={{ maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }} className="flex flex-col w-full">

                {/* Title */}
                <h1 className="text-[#344054] text-[26px] font-bold leading-tight tracking-tight mb-1 text-center">{t.title}</h1>
                <div className="mx-auto" style={{ width: 56, height: 3.5, borderRadius: 999, background: '#2270e3', marginTop: 4 }}></div>

                {/* Username */}
                <div className="mt-[18px]">
                  <InputField label={t.usernameLabel} icon={<UserIcon />} placeholder={t.usernamePlaceholder} value={username} onChange={setUsername} isError={isUsernameError && !!error} />
                </div>

                {/* Password */}
                <div className="mt-[16px]">
                  <InputField label={t.passwordLabel} icon={<LockIcon />} type="password" placeholder={t.passwordPlaceholder} value={password} onChange={setPassword} isError={isPasswordError && !!error} />
                </div>

                {/* Confirm Password */}
                <div className="mt-[16px]">
                  <InputField label={t.confirmPasswordLabel} icon={<LockIcon />} type="password" placeholder={t.confirmPasswordPlaceholder} value={password2} onChange={setPassword2} isError={isPassword2Error && !!error} />
                </div>

                {/* Sign Up button */}
                <div className="mt-[20px] w-full">
                  <Button type="submit" fullWidth color="primary" isLoading={submitting}
                          style={{ height: 52, fontSize: 16, borderRadius: 10, background: '#1f6fe5', fontWeight: 'bold' }} className="font-bold">
                    {t.signUpBtn}
                  </Button>
                </div>

                {/* Spacer */}
                <div style={{ minHeight: 30 }}></div>

                {/* Login link */}
                <p className="text-sm text-center w-full mb-[18px] px-2 text-gray-400">
                  {t.hasAccount}{' '}
                  <Link to="/login" style={{ color: '#2270e3' }} className="font-semibold no-underline transition-colors hover:text-blue-700 ml-1">{t.logIn}</Link>
                </p>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
