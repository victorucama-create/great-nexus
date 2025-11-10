// Dashboard Module
class DashboardModule {
    constructor() {
        this.apiClient = new ApiClient();
        this.chart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refresh-products')?.addEventListener('click', () => {
            this.loadData();
        });
    }

    async loadData() {
        await this.loadStats();
        await this.loadRecentActivities();
        this.initChart();
    }

    async loadStats() {
        try {
            // Load products count
            const productsResponse = await this.apiClient.getProducts();
            if (productsResponse.success) {
                const totalProducts = productsResponse.data.products.length;
                document.getElementById('total-products').textContent = totalProducts;
            }

            // Load investments
            const investmentsResponse = await this.apiClient.getInvestments();
            if (investmentsResponse.success) {
                const investments = investmentsResponse.data.investments;
                const totalInvested = investments.reduce((sum, inv) => sum + inv.capital, 0);
                const totalReturns = investments.reduce((sum, inv) => sum + inv.net_return, 0);
                
                document.getElementById('mola-balance').textContent = `${totalInvested.toLocaleString()} MZN`;
            }

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    async loadRecentActivities() {
        const activities = [
            {
                icon: 'shopping-cart',
                type: 'success',
                message: 'Novo pedido recebido #ORD-0012',
                time: 'Há 5 minutos'
            },
            {
                icon: 'file-invoice',
                type: 'primary', 
                message: 'Fatura #INV-0045 foi paga',
                time: 'Há 1 hora'
            },
            {
                icon: 'user',
                type: 'info',
                message: 'Novo cliente registado: Empresa XYZ',
                time: 'Há 2 horas'
            },
            {
                icon: 'exclamation-triangle',
                type: 'warning',
                message: 'Stock baixo para o produto "Monitor LED 24"',
                time: 'Há 4 horas'
            }
        ];

        const container = document.getElementById('recent-activities');
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas fa-${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <p>${activity.message}</p>
                    <span class="activity-time">${activity.time}</span>
                </div>
            </div>
        `).join('');
    }

    initChart() {
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

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

        this.chart = new Chart(ctx, {
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
}

// Initialize dashboard module
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardModule = new DashboardModule();
});
