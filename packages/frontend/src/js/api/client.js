// API Client for Great Nexus
class ApiClient {
    constructor() {
        this.baseURL = 'http://localhost:3001/api/v1';
        this.token = localStorage.getItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token if available
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Handle token expiration
            if (response.status === 401) {
                const newToken = await window.authManager.refreshToken();
                if (newToken) {
                    this.token = newToken;
                    config.headers.Authorization = `Bearer ${newToken}`;
                    return await fetch(url, config);
                }
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint);
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ERP Methods
    async getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/erp/products?${query}`);
    }

    async createProduct(productData) {
        return this.post('/erp/products', productData);
    }

    async updateProduct(id, productData) {
        return this.put(`/erp/products/${id}`, productData);
    }

    async deleteProduct(id) {
        return this.delete(`/erp/products/${id}`);
    }

    // Great Mola Methods
    async getInvestments() {
        return this.get('/mola/investments');
    }

    async createInvestment(investmentData) {
        return this.post('/mola/investments', investmentData);
    }

    // B2B Marketplace Methods
    async getMarketplaceProducts() {
        return this.get('/b2b/products');
    }

    async createOrder(orderData) {
        return this.post('/b2b/orders', orderData);
    }
}

// Initialize API client
window.apiClient = new ApiClient();
