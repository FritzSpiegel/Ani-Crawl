import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Details from './pages/Details.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/anime/:id" element={<Details />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify" element={<VerifyEmail />} />
                <Route path="/login" element={<Login />} />
            </Routes>
        </AuthProvider>
    );
}
