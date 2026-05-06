import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/protected-route'
import SignInPage from './pages/signin-page';
import ChatPage from './pages/chat-page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<SignInPage></SignInPage>} />
        <Route path='/' element={<div>Login Page</div>} />
        <Route path='/chat' element={
          <ProtectedRoute>
            <div>Login Page</div>
            <ChatPage>

            </ChatPage>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App
