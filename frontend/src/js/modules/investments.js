// Investments Module
class InvestmentsModule {
    constructor() {
        this.apiClient = new ApiClient();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupInvestmentCalculator();
    }

    setupEventListeners() {
        // New investment button
        document.getElementById('new-investment-btn')?.addEventListener('click', () => {
            window.greatNexusApp.showModal('new-investment-modal');
        });

        // Save investment form
        document.getElementById('save-investment')?.addEventListener('click', () => {
            this.createInvestment();
        });

        // Investment calculator
        const capitalInput = document.getElementById('investment-capital');
        const daysInput = document.getElementById('investment-days');

        if (capitalInput && daysInput) {
            capitalInput.addEventListener('input', () => this.calculateReturns());
            daysInput.addEventListener('input', () => this.calculateReturns());
        }
    }

    setupInvestmentCalculator() {
        // Initial calculation
        this.calculateReturns();
    }

    calculateReturns() {
        const capital = parseFloat(document.getElementById('investment-capital')?.value) || 0;
        const days = parseInt(document.getElementById('investment-days')?.value) || 0;
        const rate = 0.003; // 0.3% daily rate

        if (capital > 0 && days > 0) {
            const gross = capital * days * rate;
            const tax = gross * 0.20; // 20% tax
            const net = gross - tax;

            document.getElementById('preview-gross').textContent = 
                `${gross.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`;
            document.getElementById('preview-tax').textContent = 
                `${tax.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`;
            document.getElementById('preview-net').textContent = 
                `${net.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`;
        } else {
            document.getElementById('preview-gross').textContent = '0 MZN';
            document.getElementById('preview-tax').textContent = '0 MZN';
            document.getElementById('preview-net').textContent = '0 MZN';
        }
    }

    async loadInvestments() {
        try {
            const response = await this.apiClient.getInvestments();

            if (response.success) {
                this.displayInvestments(response.data.investments);
                this.updateInvestmentStats(response.data.investments);
            } else {
                window.greatNexusApp.showNotification('Erro ao carregar investimentos', 'error');
            }
        } catch (error) {
            console.error('Error loading investments:', error);
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
        }
    }

    displayInvestments(investments) {
        const container = document.getElementById('investments-list-container');
        
        if (investments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <h3>Nenhum investimento</h3>
                    <p>Comece a investir para ver seus retornos aqui</p>
                    <button class="btn btn-primary" onclick="window.greatNexusApp.showModal('new-investment-modal')">
                        Fazer Primeiro Investimento
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = investments.map(investment => `
            <div class="investment-item">
                <div class="investment-info">
                    <h4>Investimento #${investment.id.slice(-6)}</h4>
                    <div class="investment-meta">
                        <span>Capital: <strong>${investment.capital.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN</strong></span>
                        <span>Dias: ${investment.business_days}</span>
                        <span>Início: ${new Date(investment.start_date).toLocaleDateString('pt-PT')}</span>
                    </div>
                </div>
                <div class="investment-returns">
                    <div class="return-amount">
                        +${investment.net_return.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                    </div>
                    <div class="return-details">
                        Retorno líquido
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateInvestmentStats(investments) {
        const totalInvested = investments.reduce((sum, inv) => sum + inv.capital, 0);
        const totalReturns = investments.reduce((sum, inv) => sum + inv.net_return, 0);
        const activeInvestments = investments.filter(inv => inv.status === 'active').length;

        document.getElementById('total-invested').textContent = 
            `${totalInvested.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`;
        document.getElementById('total-returns').textContent = 
            `${totalReturns.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`;
        document.getElementById('active-investments').textContent = activeInvestments;
    }

    async createInvestment() {
        const formData = {
            capital: parseFloat(document.getElementById('investment-capital').value),
            business_days: parseInt(document.getElementById('investment-days').value),
            daily_rate: 0.003
        };

        // Validation
        if (!formData.capital || formData.capital <= 0) {
            window.greatNexusApp.showNotification('Insira um capital válido', 'error');
            return;
        }

        if (!formData.business_days || formData.business_days <= 0) {
            window.greatNexusApp.showNotification('Insira um número válido de dias', 'error');
            return;
        }

        try {
            const response = await this.apiClient.createInvestment(formData);

            if (response.success) {
                window.greatNexusApp.hideModal('new-investment-modal');
                document.getElementById('new-investment-form').reset();
                this.calculateReturns();
                this.loadInvestments();
                window.greatNexusApp.showNotification('Investimento criado com sucesso!', 'success');
            } else {
                window.greatNexusApp.showNotification(response.error || 'Erro ao criar investimento', 'error');
            }
        } catch (error) {
            console.error('Error creating investment:', error);
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
        }
    }
}

// Initialize investments module
document.addEventListener('DOMContentLoaded', () => {
    window.investmentsModule = new InvestmentsModule();
});
