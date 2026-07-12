import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import HomeArticles from './pages/HomeArticles';
import QuestionDetail from './pages/QuestionDetail';
import AskQuestion from './pages/AskQuestion';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
import CreateArticle from './pages/CreateArticle';
import PostbarHome from './pages/PostbarHome';
import Toolbox from './pages/Toolbox';
import OcrScan from './pages/OcrScan';
import SubbarDetail from './pages/SubbarDetail';
import PostDetail from './pages/PostDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import SearchResults from './pages/SearchResults';
import AiChat from './pages/AiChat';
import Mailbox from './pages/Mailbox';
import MemoryView from './pages/MemoryView';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminContent from './pages/AdminContent';
import LinkedClassroom from './pages/LinkedClassroom';
import LinkedClassroomCourse from './pages/LinkedClassroomCourse';
import PwaUpdateToast from './components/PwaUpdateToast';

// Cordova 原生壳把内容托管在 https://localhost/index.html（无服务端路由，也没有
// history rewrite），BrowserRouter 起始路径是 /index.html，匹配不到任何路由 → 白屏。
// 用 HashRouter 把路由放进 URL 片段（#/...），与托管路径解耦；网页/PWA 仍用
// BrowserRouter 保持真实路径。判据是构建 mode（见 vite.config 的 build:cordova）。
const Router = import.meta.env.MODE === 'cordova' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
        <AuthProvider>
          <UIProvider>
            <ToastProvider>
            <Routes>
              {/* Auth pages — no Layout wrapper */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* All other pages rendered inside Layout via <Outlet /> */}
              <Route element={<Layout />}>
                <Route path="/" element={<HomeArticles />} />
                <Route path="/qa" element={<Home />} />
                <Route path="/qa/questions/:id" element={<QuestionDetail />} />
                <Route path="/qa/ask" element={<AskQuestion />} />
                <Route path="/knowledge" element={<KnowledgeBase />} />
                <Route path="/knowledge/create" element={<CreateArticle />} />
                <Route path="/knowledge/:id" element={<ArticleDetail />} />
                <Route path="/postbar" element={<PostbarHome />} />
                <Route path="/postbar/b/:subbarId" element={<SubbarDetail />} />
                <Route path="/postbar/posts/:id" element={<PostDetail />} />
                <Route path="/toolbox" element={<Toolbox />} />
                <Route path="/toolbox/ocr" element={<OcrScan />} />
                <Route path="/chat" element={<ChatList />} />
                <Route path="/chat/:userId" element={<ChatDetail />} />
                <Route path="/chat/ai" element={<AiChat />} />
                <Route path="/mailbox" element={<Mailbox />} />
                <Route path="/admin/memory" element={<MemoryView />} />
                <Route path="/user/:userId" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/content" element={<AdminContent />} />
                <Route path="/linkedclassroom" element={<LinkedClassroom />} />
                <Route path="/linkedclassroom/:courseId" element={<LinkedClassroomCourse />} />
              </Route>
            </Routes>
            <PwaUpdateToast />
            </ToastProvider>
          </UIProvider>
        </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}
