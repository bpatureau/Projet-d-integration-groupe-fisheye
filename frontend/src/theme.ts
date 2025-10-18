import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        primary: { main: '#1976d2' },
        secondary: { main: '#388e3c' },
        background: { default: '#f4f6f8', paper: '#ffffff' },
    },
    typography: {
        fontFamily: 'Roboto, sans-serif',
        h4: { fontWeight: 600 },
        button: { textTransform: 'none' },
    },
});
