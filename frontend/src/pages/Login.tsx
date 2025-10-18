import React, { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    Box
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

export function Login() {
    const navigate = useNavigate();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulation front-end (à remplacer par appel API ultérieurement)
        if (email === 'admin@exemple.com' && password === 'admin') {
            localStorage.setItem('auth_token', 'dummy-token');
            navigate('/dashboard');
        } else {
            setError('Identifiants invalides');
        }
    };

    return (
        <Container maxWidth="xs">
            <Paper elevation={6} sx={{ p: 4, mt: 12, borderRadius: 2 }}>
                <Typography variant="h4" align="center" gutterBottom>
                    Connexion
                </Typography>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <Box component="form" onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        margin="normal"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        label="Mot de passe"
                        type="password"
                        margin="normal"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        type="submit"
                        sx={{ mt: 2 }}
                    >
                        Se connecter
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}
