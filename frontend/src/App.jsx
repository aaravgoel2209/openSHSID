import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import QuestionDetail from './pages/QuestionDetail';
import AskQuestion from './pages/AskQuestion';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
import CreateArticle from './pages/CreateArticle';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<div className="text-center text-gray-400 dark:text-gray-600 py-20"><p className="text-lg">欢迎来到 SHSID 校园</p></div>} />
              <Route path="/qa" element={<Home />} />
              <Route path="/qa/questions/:id" element={<QuestionDetail />} />
              <Route path="/qa/ask" element={<AskQuestion />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/knowledge/create" element={<CreateArticle />} />
              <Route path="/knowledge/:id" element={<ArticleDetail />} />
              <Route path="/chat" element={<ChatList />} />
              <Route path="/chat/:userId" element={<ChatDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
