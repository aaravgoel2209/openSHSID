import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import HomeArticles from './pages/HomeArticles';
import QuestionDetail from './pages/QuestionDetail';
import AskQuestion from './pages/AskQuestion';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
import CreateArticle from './pages/CreateArticle';
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

const AUTH_ROUTES = ['/login', '/register'];

function Routing() {
  const location = useLocation();
  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  return (
    <>
      {!isAuthPage && <Layout />}
      <Routes>
        <Route path="/" element={<HomeArticles />} />
        <Route path="/qa" element={<Home />} />
        <Route path="/qa/questions/:id" element={<QuestionDetail />} />
        <Route path="/qa/ask" element={<AskQuestion />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/knowledge/create" element={<CreateArticle />} />
        <Route path="/knowledge/:id" element={<ArticleDetail />} />
        <Route path="/chat" element={<ChatList />} />
        <Route path="/chat/:userId" element={<ChatDetail />} />
        <Route path="/chat/ai" element={<AiChat />} />
        <Route path="/mailbox" element={<Mailbox />} />
        <Route path="/admin/memory" element={<MemoryView />} />
        <Route path="/user/:userId" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/content" element={<AdminContent />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <UIProvider>
            <Routing />
          </UIProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
