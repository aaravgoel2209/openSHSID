import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import UserProfile from './pages/UserProfile';
import SearchResults from './pages/SearchResults';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomeArticles />} />
              <Route path="/qa" element={<Home />} />
              <Route path="/qa/questions/:id" element={<QuestionDetail />} />
              <Route path="/qa/ask" element={<AskQuestion />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/knowledge/create" element={<CreateArticle />} />
              <Route path="/knowledge/:id" element={<ArticleDetail />} />
              <Route path="/chat" element={<ChatList />} />
              <Route path="/chat/:userId" element={<ChatDetail />} />
              <Route path="/user/:userId" element={<UserProfile />} />
              <Route path="/search" element={<SearchResults />} />
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
