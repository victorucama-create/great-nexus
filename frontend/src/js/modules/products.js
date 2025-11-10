// Products Module
class ProductsModule {
    constructor() {
        this.apiClient = new ApiClient();
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // New product button
        document.getElementById('new-product-btn')?.addEventListener('click', () => {
            window.greatNexusApp.showModal('new-product-modal');
        });

        // Save product form
        document.getElementById('save-product')?.addEventListener('click', () => {
            this.createProduct();
        });

        // Product search
        document.getElementById('product-search')?.addEventListener('input', (e) => {
            this.searchProducts(e.target.value);
        });

        // Refresh products
        document.getElementById('refresh-products')?.addEventListener('click', () => {
            this.loadProducts();
        });
    }

    async loadProducts() {
        try {
            const response = await this.apiClient.getProducts({
                page: this.currentPage,
                limit: this.itemsPerPage
            });

            if (response.success) {
                this.displayProducts(response.data.products);
                this.updatePagination(response.data.pagination);
            } else {
                window.greatNexusApp.showNotification('Erro ao carregar produtos', 'error');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('products-table-body');
        
        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table">
                        <i class="fas fa-cube"></i>
                        <p>Nenhum produto encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.sku}</td>
                <td>${product.name}</td>
                <td>${product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN</td>
                <td>
                    <span class="stock-badge ${product.stock > 10 ? 'in-stock' : 'low-stock'}">
                        ${product.stock}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="productsModule.editProduct('${product.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-danger" onclick="productsModule.deleteProduct('${product.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updatePagination(pagination) {
        const container = document.getElementById('products-pagination');
        if (!container) return;

        if (pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous button
        if (pagination.page > 1) {
            html += `<button class="pagination-btn" onclick="productsModule.goToPage(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>`;
        }

        // Page numbers
        for (let i = 1; i <= pagination.pages; i++) {
            if (i === pagination.page) {
                html += `<button class="pagination-btn active">${i}</button>`;
            } else {
                html += `<button class="pagination-btn" onclick="productsModule.goToPage(${i})">${i}</button>`;
            }
        }

        // Next button
        if (pagination.page < pagination.pages) {
            html += `<button class="pagination-btn" onclick="productsModule.goToPage(${pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadProducts();
    }

    async createProduct() {
        const form = document.getElementById('new-product-form');
        const formData = {
            sku: document.getElementById('product-sku').value,
            name: document.getElementById('product-name').value,
            price: parseFloat(document.getElementById('product-price').value),
            stock: parseInt(document.getElementById('product-stock').value)
        };

        // Validation
        if (!formData.sku || !formData.name || !formData.price || !formData.stock) {
            window.greatNexusApp.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            const response = await this.apiClient.createProduct(formData);

            if (response.success) {
                window.greatNexusApp.hideModal('new-product-modal');
                form.reset();
                this.loadProducts();
                window.greatNexusApp.showNotification('Produto criado com sucesso!', 'success');
            } else {
                window.greatNexusApp.showNotification(response.error || 'Erro ao criar produto', 'error');
            }
        } catch (error) {
            console.error('Error creating product:', error);
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
        }
    }

    searchProducts(query) {
        // Simple client-side search
        const rows = document.querySelectorAll('#products-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }

    editProduct(productId) {
        window.greatNexusApp.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
    }

    async deleteProduct(productId) {
        if (!confirm('Tem certeza que deseja eliminar este produto?')) {
            return;
        }

        // Note: You would need to implement the delete endpoint in the backend
        window.greatNexusApp.showNotification('Funcionalidade de eliminação em desenvolvimento', 'info');
    }
}

// Initialize products module
document.addEventListener('DOMContentLoaded', () => {
    window.productsModule = new ProductsModule();
});
