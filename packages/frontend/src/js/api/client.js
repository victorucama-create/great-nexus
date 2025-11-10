// API Client for Great Nexus
class ApiClient {
    constructor() {
        this.baseURL = window.location.origin + '/api/v1';
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
    }

    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
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
            const data = await response.json();

            return {
                success: response.ok,
                data: data,
                error: data.error,
                status: response.status
            };
        } catch (error) {
            console.error('API request failed:', error);
            return {
                success: false,
                error: 'Network error: ' + error.message,
                status: 0
            };
        }
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
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
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ERP Methods
    async getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/erp/products?${query}`);
    }

    async createProduct(productData) {
        return this.post('/erp/products', productData);
    }

    // Great Mola Methods
    async getInvestments() {
        return this.get('/mola/investments');
    }

    async createInvestment(investmentData) {
        return this.post('/mola/investments', investmentData);
    }
}

// Initialize API client
window.ApiClient = ApiClient;
