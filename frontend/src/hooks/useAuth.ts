import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Teacher {
    id: string;
    username: string;
    email: string;
    name: string;
}

export function useAuth() {
    const navigate = useNavigate();
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        const teacherData = localStorage.getItem('teacher');

        if (token && teacherData) {
            try {
                setTeacher(JSON.parse(teacherData));
            } catch {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('teacher');
                navigate('/login');
            }
        } else {
            navigate('/login');
        }
        setLoading(false);
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('teacher');
        navigate('/login');
    };

    return { teacher, loading, logout };
}
