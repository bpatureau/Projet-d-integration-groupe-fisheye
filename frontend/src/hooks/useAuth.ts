import { useNavigate } from 'react-router-dom';

export function useAuth() {
    const navigate = useNavigate();

    const login = (email: string, password: string) => {
        // Simulation front-end uniquement
        if (email === 'admin@exemple.com' && password === 'admin') {
            localStorage.setItem('auth_token', 'dummy-token');
            navigate('/dashboard');
        } else {
            throw new Error('Identifiants invalides');
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        navigate('/login');
    };

    const isAuthenticated = () => !!localStorage.getItem('auth_token');

    return { login, logout, isAuthenticated };
}
