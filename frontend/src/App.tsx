import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Integrations } from './pages/Integrations';
import { Layout } from './components/Layout';
import { Devices } from './pages/Devices';

export default function App() {
    const token = localStorage.getItem('auth_token');

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            {token ? (
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="devices" element={<Devices />} />
                </Route>
            ) : (
                <Route path="*" element={<Navigate to="/login" />} />
            )}
        </Routes>
    );
}


