import API from './api.js';

class Auth {
    static currentUser = null;

    static async checkAuthentication() {
        try {
            const result = await API.checkAuth();
            if (result.authenticated) {
                this.currentUser = result.user;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }

    static async login(username, password, rememberMe = true) {
        try {
            const result = await API.login(username, password, rememberMe);
            if (result.success) {
                this.currentUser = result.user;
                return { success: true };
            }
            return { success: false, error: result.error || 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    static async logout() {
        try {
            await API.logout();
            this.currentUser = null;
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    static isAuthenticated() {
        return this.currentUser !== null;
    }

    static isAdmin() {
        return this.currentUser?.role === 'admin';
    }

    static getUser() {
        return this.currentUser;
    }
}

export default Auth;
