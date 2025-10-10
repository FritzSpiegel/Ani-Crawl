import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Home from "./pages/Home";
import Details from "./pages/Details";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Watchlist from "./pages/Watchlist";
import Admin from "./pages/Admin";

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/anime/:id" element={<Details />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify" element={<VerifyEmail />} />
                <Route path="/admin" element={<Admin />} />
            </Routes>
        </AuthProvider>
    );
}
