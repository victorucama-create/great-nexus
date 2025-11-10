// Authentication handling
class AuthManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api/v1';
        this.setupAuthForms();
    }

    setupAuthForms() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.storeAuthData(data);
                window.greatNexusApp.showMainApp();
            } else {
                this.showError(data.error || 'Erro no login');
            }
        } catch (error) {
            this.showError('Erro de conexão. Tente novamente.');
        }
    }

    async handleRegister() {
        const formData = {
            name: document.getElementById('register-name').value,
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value,
            companyName: document.getElementById('register-company').value,
            country: document.getElementById('register-country').value,
            currency: document.getElementById('register-currency').value
        };

        // Basic validation
        if (formData.password !== document.getElementById('register-confirm-password').value) {
            this.showError('As passwords não coincidem');
            return;
        }

        if (!document.getElementById('accept-terms').checked) {
            this.showError('Deve aceitar os termos e condições');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.storeAuthData(data);
                window.greatNexusApp.showMainApp();
            } else {
                this.showError(data.error || 'Erro no registo');
            }
        } catch (error) {
            this.showError('Erro de conexão. Tente novamente.');
        }
    }

    storeAuthData(data) {
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        localStorage.setItem('tenant_data', JSON.stringify(data.tenant));
    }

    showError(message) {
        // Simple error display - you might want to use a more sophisticated notification system
        alert(`Erro: ${message}`);
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
            this.logout();
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('auth_token', data.accessToken);
                return data.accessToken;
            } else {
                this.logout();
                return null;
            }
        } catch (error) {
            this.logout();
            return null;
        }
    }

    logout() {
        localStorage.clear();
        window.greatNexusApp.showLogin();
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
