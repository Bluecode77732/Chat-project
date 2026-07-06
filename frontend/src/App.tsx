import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/protected-route'
import SignInPage from './pages/signin-page';
import ChatPage from './pages/chat-page';
import RegisterPage from './pages/register-page';
import AccountPage from './pages/account-page';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<SignInPage></SignInPage>} />
        <Route path='/' element={<div>Login Page</div>} />
        <Route path='/register' element={<RegisterPage></RegisterPage>} />
        <Route path='/chat' element={
          <ProtectedRoute>
            {/* <div>Login Page</div> */}
            <ChatPage>

            </ChatPage>
          </ProtectedRoute>
        } />
        <Route path='/account' element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App
