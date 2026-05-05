import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/protected-route'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<div>Login Page</div>} />
        <Route path='/chat' element={
          <ProtectedRoute>
            <div>Login Page</div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App
