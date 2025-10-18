const Auth = {
  saveAuth(authData) {
    localStorage.setItem(Config.STORAGE_KEYS.AUTH_TOKEN, authData.token.token);
    localStorage.setItem(
      Config.STORAGE_KEYS.USER,
      JSON.stringify(authData.user)
    );
    localStorage.setItem(
      Config.STORAGE_KEYS.TOKEN_EXPIRY,
      authData.token.expiry
    );
  },

  getToken() {
    return localStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
  },

  getUser() {
    const userStr = localStorage.getItem(Config.STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    const token = this.getToken();
    const expiry = localStorage.getItem(Config.STORAGE_KEYS.TOKEN_EXPIRY);

    if (!token || !expiry) return false;

    return new Date(expiry) > new Date();
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === "admin";
  },

  logout() {
    localStorage.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(Config.STORAGE_KEYS.USER);
    localStorage.removeItem(Config.STORAGE_KEYS.TOKEN_EXPIRY);
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = "/login.html";
      return false;
    }
    return true;
  },
};
