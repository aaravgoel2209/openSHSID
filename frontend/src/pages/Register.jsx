import { motion } from 'framer-motion';
import { useState, useContext, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
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
    heading: 'Hello, I am Rei', subheading: 'Your Intelligent Assistant',
    title: 'Create Account', usernameLabel: 'Username',
    usernamePlaceholder: 'Choose a Username',
    passwordLabel: 'Password', passwordPlaceholder: 'Set Password',
    confirmPasswordLabel: 'Confirm Password', confirmPasswordPlaceholder: 'Enter Password Again',
    signUpBtn: 'Sign Up', hasAccount: 'Already have an account?',
    logIn: 'Log In', registering: 'Creating...',
    passwordsMismatch: 'Passwords do not match.',
    errorGeneral: 'Registration failed. Please try again.',
  },
  zh: {
    heading: '你好，我是Rei', subheading: '你的智能助手~',
    title: '创建账号', usernameLabel: '用户名',
    usernamePlaceholder: '选择一个用户名',
    passwordLabel: '密码', passwordPlaceholder: '设置密码',
    confirmPasswordLabel: '确认密码', confirmPasswordPlaceholder: '再次输入密码',
    signUpBtn: '注册', hasAccount: '已有账号？',
    logIn: '登录', registering: '创建中...',
    passwordsMismatch: '两次密码不一致。',
    errorGeneral: '注册失败，请重试。',
  },
};

function GlobeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function AILogo() {
  return (
    <div className="relative w-full h-full" style={{ marginTop: -30 }}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" fill="url(#logoGrad)" />
        <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" fill="url(#logoGrad)" opacity=".7" />
        <defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
      </svg>
    </div>
  );
}

const djangoErrors = {
  en: {},
  zh: {
    'This field may not be blank.': '请填写此字段。',
    'A user with that username already exists.': '该用户名已被使用。',
    'This password is too short. It must contain at least 8 characters.': '密码长度不足，至少需要8个字符。',
    'This password is too common.': '此密码过于简单。',
    'This password is entirely numeric.': '密码不能仅为数字。',
    'Enter a valid username. This value may contain only letters, numbers, and @/./+/-/_ characters.': '用户名格式无效，仅可使用字母、数字和 @/./+/-/_。',
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
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => { setError(''); setIsError(false); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (username || password || password2) { setError(''); setIsError(false); }
  }, [username, password, password2]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setIsError(false);
    if (password !== password2) { setError(t.passwordsMismatch); setIsError(true); return; }
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
        setError([...new Set(msgs)].join(' ') || t.errorGeneral);
      } else {
        setError(t.errorGeneral);
      }
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => { setError(''); setIsError(false); };

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden"
         style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/35" />

      <div style={{ position: 'relative', zIndex: 10 }}>
        <img src={new URL('../assets/shsid-logo.png', import.meta.url).href} alt="SHSID"
             style={{ width: 528, height: 528, position: 'absolute', bottom: 'calc(100% - 215px)', left: '50%', transform: 'translateX(-50%)', zIndex: 30, objectFit: 'contain' }} />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-[870px] h-[510px] rounded-[16px] overflow-hidden relative flex shadow-xl"
        >
          <div className="absolute left-[39%] top-0 bottom-0 z-20 pointer-events-none w-[1px]" style={{ background: 'rgba(255,255,255,.35)' }} />

          {/* Left Panel 39% — frosted glass */}
          <div className="w-[39%] relative login-frosted-glass">
            {/* Glass effect layers */}
            <div className="absolute inset-0 pointer-events-none login-glass-light" />
            <div className="absolute inset-0 pointer-events-none login-glass-streaks" />
            <div className="absolute inset-0 pointer-events-none login-glass-mesh" />
            <div className="absolute inset-0 pointer-events-none login-glass-dots" />
            <div className="absolute inset-0 pointer-events-none login-glass-noise" />
            <div className="absolute inset-0 pointer-events-none login-glass-edge" />
            <div className="absolute inset-0 pointer-events-none login-glass-cloud" />

            <img src={new URL("../assets/shsid-logo.png", import.meta.url).href} alt="" className="absolute pointer-events-none" style={{ width: 120, height: 120, right: -30, bottom: -30, opacity: 0.035, objectFit: 'contain', filter: 'blur(2px)' }} />

            <div className="absolute inset-x-0 top-0 h-[1px] login-glass-top-edge" />
            <div className="absolute inset-x-0 bottom-0 h-[1px] login-glass-bottom-edge" />
            <div className="absolute inset-y-4 left-0 w-[1px] login-glass-left-edge" />
            <div className="absolute inset-y-4 right-0 w-[1px] login-glass-right-edge" />
            <div className="absolute bottom-0 right-0 w-[60px] h-[60px] pointer-events-none login-glass-corner-br" />
            <div className="absolute top-0 left-0 w-[80px] h-[80px] pointer-events-none login-glass-corner-tl" />

            {/* Error speech bubble */}
            <div className="absolute z-30 flex items-start gap-[5px] px-4 py-2.5 rounded-xl cursor-pointer group mx-auto" onClick={handleClear}
                 style={{ left: 0, right: 0, width: 220, justifyContent: 'center', top: 28, background: error ? '#ffffff' : 'transparent', border: error ? '2.5px solid #feabad' : 'none', boxShadow: error ? '0 8px 24px rgba(254,171,173,.3)' : 'none', opacity: error ? 1 : 0, transform: `scale(${error ? 1 : 0.7})`, transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="absolute -bottom-[8px] left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: error ? '7px solid transparent' : '7px solid rgba(0,0,0,0)', borderRight: error ? '7px solid transparent' : '7px solid rgba(0,0,0,0)', borderTop: error ? '8px solid #feabad' : '8px solid rgba(254,171,173,0)' }} />
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

            <img src={new URL("../assets/shsid-watermark.png", import.meta.url).href} alt="SHSID" className="absolute pointer-events-none" style={{ width: 150, height: 150, right: -50, bottom: -40, opacity: 0.8, zIndex: 40, objectFit: 'contain' }} />

            <button type="button" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
                    className="absolute left-5 bottom-[18px] z-[100] flex items-center gap-2 text-white bg-white/10 rounded-full px-3 py-2 hover:bg-white/20 transition-all backdrop-blur-sm cursor-pointer border border-white/20">
              <GlobeIcon />
              <span className="text-xs font-semibold">{lang === 'en' ? 'EN' : '中文'}</span>
            </button>
          </div>

          {/* Right Panel 61% */}
          <div className="w-[61%] relative bg-white dark:bg-gray-950">
            <img src={new URL("../assets/shsid-watermark.png", import.meta.url).href} alt="SHSID" className="absolute pointer-events-none" style={{ width: 155, height: 155, right: -42, top: -32, opacity: 0.75, objectFit: 'contain' }} />

            <div className="relative z-10 flex flex-col items-center" style={{ paddingTop: 32, paddingBottom: 24 }}>
              <form onSubmit={handleSubmit} style={{ maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }} className="flex flex-col w-full">
                <h1 className="text-[#344054] text-[26px] font-bold leading-tight tracking-tight mb-1 text-center">{t.title}</h1>
                <div className="mx-auto" style={{ width: 56, height: 3.5, borderRadius: 999, background: '#2270e3', marginTop: 4 }} />

                <div className="mt-[18px] space-y-[16px]">
                  <Input
                    label={t.usernameLabel}
                    placeholder={t.usernamePlaceholder}
                    value={username}
                    onValueChange={setUsername}
                    isInvalid={isError && !!error}
                    variant="flat"
                    size="lg"
                  />
                  <Input
                    label={t.passwordLabel}
                    placeholder={t.passwordPlaceholder}
                    type="password"
                    value={password}
                    onValueChange={setPassword}
                    isInvalid={isError && !!error}
                    variant="flat"
                    size="lg"
                  />
                  <Input
                    label={t.confirmPasswordLabel}
                    placeholder={t.confirmPasswordPlaceholder}
                    type="password"
                    value={password2}
                    onValueChange={setPassword2}
                    isInvalid={isError && !!error}
                    variant="flat"
                    size="lg"
                  />
                </div>

                <div className="mt-[20px] w-full">
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button type="submit" fullWidth color="primary" isLoading={submitting} className="font-bold" style={{ height: 52, fontSize: 16, borderRadius: 10, background: '#1f6fe5' }}>
                      {t.signUpBtn}
                    </Button>
                  </motion.div>
                </div>

                <div style={{ minHeight: 30 }} />

                <p className="text-sm text-center w-full mb-[18px] px-2 text-gray-400">
                  {t.hasAccount}{' '}
                  <Link to="/login" style={{ color: '#2270e3' }} className="font-semibold no-underline transition-colors hover:text-blue-700 ml-1">{t.logIn}</Link>
                </p>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
