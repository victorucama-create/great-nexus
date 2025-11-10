// Great Nexus - Main Application
class GreatNexusApp {
    constructor() {
        this.currentUser = null;
        this.currentTenant = null;
        this.currentModule = 'dashboard';
        this.apiClient = new ApiClient();
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupEventListeners();
        this.setupModals();
    }

    checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.currentTenant = JSON.parse(localStorage.getItem('tenant_data'));
                this.showMainApp();
            } catch (error) {
                console.error('Error parsing stored data:', error);
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    showLogin() {
        this.hideAllScreens();
        document.getElementById('auth-screens').classList.remove('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }

    showRegister() {
        this.hideAllScreens();
        document.getElementById('auth-screens').classList.remove('hidden');
        document.getElementById('register-screen').classList.remove('hidden');
    }

    showMainApp() {
        this.hideAllScreens();
        document.getElementById('main-app').classList.remove('hidden');
        this.updateUserInterface();
        this.loadCurrentModule();
    }

    hideAllScreens() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screens').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
        
        // Hide all auth screens
        document.querySelectorAll('.auth-screen').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    updateUserInterface() {
        if (this.currentUser) {
            document.getElementById('current-user').textContent = this.currentUser.name;
            document.getElementById('current-tenant').textContent = this.currentTenant.name;
        }
    }

    setupEventListeners() {
        // Auth navigation
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        // Demo login
        document.getElementById('demo-login-btn').addEventListener('click', () => {
            this.handleDemoLogin();
        });

        // Sidebar navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const module = item.dataset.module;
                this.switchModule(module);
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        // User menu
        document.getElementById('user-menu-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown').classList.toggle('hidden');
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.add('hidden');
        });

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    setupModals() {
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                this.hideModal(modalId);
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    async handleDemoLogin() {
        try {
            const response = await this.apiClient.post('/auth/demo', {});
            
            if (response.success) {
                this.storeAuthData(response.data);
                this.showMainApp();
                this.showNotification('Login demo realizado com sucesso!', 'success');
            } else {
                this.showNotification(response.error || 'Erro no login demo', 'error');
            }
        } catch (error) {
            console.error('Demo login error:', error);
            this.showNotification('Erro de conexão durante o login demo', 'error');
        }
    }

    storeAuthData(data) {
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        localStorage.setItem('tenant_data', JSON.stringify(data.tenant));
        
        this.currentUser = data.user;
        this.currentTenant = data.tenant;
        this.apiClient.setToken(data.accessToken);
    }

    switchModule(moduleName) {
        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-module="${moduleName}"]`).classList.add('active');

        // Hide all modules
        document.querySelectorAll('.module-content').forEach(module => {
            module.classList.add('hidden');
        });

        // Show target module
        const targetModule = document.getElementById(`${moduleName}-module`);
        if (targetModule) {
            targetModule.classList.remove('hidden');
        }

        // Update page title and breadcrumb
        this.updatePageTitle(moduleName);
        this.currentModule = moduleName;

        // Load module data
        this.loadModuleData(moduleName);
    }

    updatePageTitle(moduleName) {
        const titles = {
            dashboard: 'Dashboard',
            products: 'Produtos',
            sales: 'Vendas',
            inventory: 'Inventário',
            invoices: 'Faturas',
            mrp: 'Planeamento (MRP)',
            investments: 'Investimentos',
            wallet: 'Carteira'
        };

        const title = titles[moduleName] || 'Great Nexus';
        document.getElementById('page-title').textContent = title;
        document.getElementById('breadcrumb-current').textContent = title;
    }

    loadModuleData(moduleName) {
        console.log(`Loading data for module: ${moduleName}`);
        
        if (moduleName === 'dashboard') {
            window.dashboardModule?.loadData();
        } else if (moduleName === 'products') {
            window.productsModule?.loadProducts();
        } else if (moduleName === 'investments') {
            window.investmentsModule?.loadInvestments();
        }
    }

    handleQuickAction(action) {
        const actions = {
            'new-product': () => this.showModal('new-product-modal'),
            'new-investment': () => this.showModal('new-investment-modal'),
            'new-invoice': () => this.showNotification('Funcionalidade em desenvolvimento', 'info'),
            'reports': () => this.showNotification('Relatórios em breve', 'info')
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications-container');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('tenant_data');
        this.currentUser = null;
        this.currentTenant = null;
        this.apiClient.setToken(null);
        this.showLogin();
        this.showNotification('Sessão terminada com sucesso', 'info');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1000);

    window.greatNexusApp = new GreatNexusApp();
});
