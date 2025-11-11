import React, { useState } from 'react';
import {
    Container,
    Paper,
    TextField,
    Button,
    Box,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.login(username, password);

            // Stockage du token et des infos prof
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('teacher', JSON.stringify(response.teacher));

            // Redirection
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Identifiants invalides');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom textAlign="center" mb={3}>
                    Connexion Professeur
                </Typography>

                <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        label="Nom d'utilisateur"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        disabled={loading}
                        fullWidth
                        autoFocus
                    />

                    <TextField
                        label="Mot de passe"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={loading}
                        fullWidth
                    />

                    <Button
                        variant="contained"
                        type="submit"
                        disabled={loading || !username || !password}
                        fullWidth
                        size="large"
                    >
                        {loading ? <CircularProgress size={24} /> : 'Se connecter'}
                    </Button>
                </Box>

                <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 3, color: 'text.secondary' }}>
                    Credentials de démo : admin / admin
                </Typography>
            </Paper>
        </Container>
    );
}
