import React from 'react';
import {
    Box,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    CssBaseline
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

const drawerWidth = 240;

export function Layout() {
    const [open, setOpen] = React.useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, teacher } = useAuth();

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Intégrations', icon: <SettingsIcon />, path: '/integrations' }
    ];

    const handleLogout = () => {
        logout();
    };

    const toggleDrawer = () => {
        setOpen(!open);
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={toggleDrawer}
                        sx={{ mr: 2 }}
                        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Sonnette Connectée
                    </Typography>
                    {teacher && (
                        <Typography variant="body2" sx={{ mr: 2 }}>
                            {teacher.name}
                        </Typography>
                    )}
                    <IconButton color="inherit" onClick={handleLogout} aria-label="Déconnexion">
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Drawer
                variant="persistent"
                open={open}
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box'
                    }
                }}
            >
                <Toolbar />
                <List>
                    {menuItems.map(({ text, icon, path }) => (
                        <ListItem key={text} disablePadding>
                            <ListItemButton
                                selected={location.pathname === path}
                                onClick={() => {
                                    navigate(path);
                                    setOpen(false);
                                }}
                                aria-current={location.pathname === path ? 'page' : undefined}
                            >
                                <ListItemIcon>{icon}</ListItemIcon>
                                <ListItemText primary={text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Drawer>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    ml: open ? `${drawerWidth}px` : 0,
                    transition: theme =>
                        theme.transitions.create('margin', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.leavingScreen
                        })
                }}
            >
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}
