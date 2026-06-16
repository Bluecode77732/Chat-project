import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/protected-route';
import LoginPage from './pages/login-page';
import UsersPage from './pages/users-page';
import RoomsPage from './pages/rooms-page';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path='/' element={<LoginPage />} />
                <Route path='/users' element={
                    <ProtectedRoute>
                        <UsersPage />
                    </ProtectedRoute>
                } />
                <Route path='/rooms' element={
                    <ProtectedRoute>
                        <RoomsPage />
                    </ProtectedRoute>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
