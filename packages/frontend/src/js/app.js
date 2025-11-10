// Great Nexus - Main Application JavaScript
class GreatNexusApp {
    constructor() {
        this.currentUser = null;
        this.currentTenant = null;
        this.currentModule = 'dashboard';
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupEventListeners();
        this.loadCurrentModule();
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
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('register-screen').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showRegister() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('register-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('register-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        this.updateUserInterface();
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
        document.getElementById('user-menu-toggle').addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.toggle('hidden');
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Notifications
        document.getElementById('notifications-btn').addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('close-notifications').addEventListener('click', () => {
            this.closeNotifications();
        });

        // Search
        document.getElementById('search-btn').addEventListener('click', () => {
            this.toggleSearch();
        });

        document.getElementById('close-search').addEventListener('click', () => {
            this.closeSearch();
        });

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-panel') && !e.target.closest('#notifications-btn')) {
                this.closeNotifications();
            }
            if (!e.target.closest('.search-panel') && !e.target.closest('#search-btn')) {
                this.closeSearch();
            }
            if (!e.target.closest('.user-dropdown') && !e.target.closest('#user-menu-toggle')) {
                document.getElementById('user-dropdown').classList.add('hidden');
            }
        });
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
            production: 'Ordens Produção',
            crm: 'CRM',
            marketing: 'Marketing',
            investments: 'Investimentos',
            wallet: 'Carteira',
            marketplace: 'B2B Marketplace'
        };

        const title = titles[moduleName] || 'Great Nexus';
        document.getElementById('page-title').textContent = title;
        document.getElementById('breadcrumb-current').textContent = title;
    }

    loadModuleData(moduleName) {
        // This would typically make API calls to load module-specific data
        console.log(`Loading data for module: ${moduleName}`);
        
        // Example: Load products when switching to products module
        if (moduleName === 'products') {
            this.loadProducts();
        } else if (moduleName === 'investments') {
            this.loadInvestments();
        }
    }

    loadProducts() {
        // Example products data - in real app, this would come from API
        const productsContainer = document.querySelector('.products-container');
        productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cube"></i>
                <h3>Carregando produtos...</h3>
                <p>A buscar dados do servidor.</p>
            </div>
        `;

        // Simulate API call
        setTimeout(() => {
            productsContainer.innerHTML = `
                <div class="module-toolbar">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Pesquisar produtos...">
                    </div>
                    <div class="toolbar-actions">
                        <button class="btn btn-outline">
                            <i class="fas fa-filter"></i>
                            Filtrar
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Nome</th>
                                <th>Preço</th>
                                <th>Stock</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>PROD-001</td>
                                <td>Monitor LED 24"</td>
                                <td>8.500 MZN</td>
                                <td>15</td>
                                <td>
                                    <button class="btn btn-sm btn-outline">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        }, 1000);
    }

    loadInvestments() {
        // Similar implementation for investments
    }

    toggleNotifications() {
        document.getElementById('notifications-panel').classList.toggle('hidden');
    }

    closeNotifications() {
        document.getElementById('notifications-panel').classList.add('hidden');
    }

    toggleSearch() {
        document.getElementById('search-panel').classList.toggle('hidden');
        if (!document.getElementById('search-panel').classList.contains('hidden')) {
            document.getElementById('global-search').focus();
        }
    }

    closeSearch() {
        document.getElementById('search-panel').classList.add('hidden');
    }

    handleQuickAction(action) {
        const actions = {
            'new-sale': () => this.switchModule('sales'),
            'new-product': () => this.switchModule('products'),
            'new-invoice': () => this.switchModule('invoices'),
            'new-investment': () => this.switchModule('investments'),
            'b2b-market': () => this.switchModule('marketplace'),
            'reports': () => this.showReports()
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    showReports() {
        alert('Funcionalidade de relatórios em desenvolvimento...');
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('tenant_data');
        this.showLogin();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.greatNexusApp = new GreatNexusApp();
});

// Chart initialization for dashboard
function initializeCharts() {
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    
    // Sample sales data
    const salesData = {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        datasets: [{
            label: 'Vendas (MZN)',
            data: [12000, 19000, 15000, 25000, 22000, 30000, 28000],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    };

    new Chart(salesCtx, {
        type: 'line',
        data: salesData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Initialize charts when dashboard is loaded
document.addEventListener('DOMContentLoaded', initializeCharts);
