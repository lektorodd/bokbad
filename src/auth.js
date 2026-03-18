// @ts-check
import API from './api.js';

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} [display_name]
 * @property {'admin'|'user'} role
 * @property {boolean} [must_change_password]
 */

class Auth {
  /** @type {User|null} */
  static currentUser = null;

  /**
   * Check if the user is currently authenticated
   * @returns {Promise<boolean>}
   */
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

  /**
   * Log in with credentials
   * @param {string} username
   * @param {string} password
   * @param {boolean} [rememberMe=true]
   * @returns {Promise<{success: boolean, error?: string}>}
   */
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

  /**
   * Log out the current user
   * @returns {Promise<boolean>}
   */
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

  /**
   * Whether a user is currently authenticated
   * @returns {boolean}
   */
  static isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Whether the current user has admin role
   * @returns {boolean}
   */
  static isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  /**
   * Get the current user object
   * @returns {User|null}
   */
  static getUser() {
    return this.currentUser;
  }
}

export default Auth;
