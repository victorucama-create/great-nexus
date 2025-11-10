// Authentication handling
class AuthManager {
    constructor() {
        this.apiClient = new ApiClient();
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

        try {
            const response = await this.apiClient.post('/auth/login', {
                email,
                password
            });

            if (response.success) {
                window.greatNexusApp.storeAuthData(response.data);
                window.greatNexusApp.showMainApp();
                window.greatNexusApp.showNotification('Login realizado com sucesso!', 'success');
            } else {
                window.greatNexusApp.showNotification(response.error || 'Erro no login', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            window.greatNexusApp.showNotification('Erro de conexão. Tente novamente.', 'error');
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
            window.greatNexusApp.showNotification('As passwords não coincidem', 'error');
            return;
        }

        if (!document.getElementById('accept-terms').checked) {
            window.greatNexusApp.showNotification('Deve aceitar os termos e condições', 'error');
            return;
        }

        try {
            const response = await this.apiClient.post('/auth/register', formData);

            if (response.success) {
                window.greatNexusApp.storeAuthData(response.data);
                window.greatNexusApp.showMainApp();
                window.greatNexusApp.showNotification('Conta criada com sucesso!', 'success');
            } else {
                window.greatNexusApp.showNotification(response.error || 'Erro no registo', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            window.greatNexusApp.showNotification('Erro de conexão. Tente novamente.', 'error');
        }
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
