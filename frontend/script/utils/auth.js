// Après un login réussi
function saveAuth(authData) {
    localStorage.setItem('authToken', authData.token.token);
    localStorage.setItem('user', JSON.stringify(authData.user));
    localStorage.setItem('tokenExpiry', authData.token.expiry);
}

// Récupérer les infos
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Vérifier si le token est expiré
function isTokenExpired() {
    const expiry = localStorage.getItem('tokenExpiry');
    if (!expiry) return true;
    return new Date(expiry) < new Date();
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
}