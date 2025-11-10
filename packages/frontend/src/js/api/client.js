// API Client for Great Nexus - Client-side only version
class ApiClient {
    constructor() {
        this.baseURL = window.location.origin + '/api/v1';
        this.token = localStorage.getItem('auth_token');
        this.useMockData = true; // Use mock data until backend is ready
    }

    setToken(token) {
        this.token = token;
    }

    async request(endpoint, options = {}) {
        // If backend is not available, use mock data
        if (this.useMockData) {
            return this.mockRequest(endpoint, options);
        }

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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                success: true,
                data: data,
                error: null,
                status: response.status
            };
        } catch (error) {
            console.error('API request failed, falling back to mock data:', error);
            // Fallback to mock data
            return this.mockRequest(endpoint, options);
        }
    }

    // Mock data for demo purposes
    mockRequest(endpoint, options) {
        console.log('Using mock data for:', endpoint);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                let response;
                
                switch (endpoint) {
                    case '/auth/demo':
                        response = this.mockDemoLogin();
                        break;
                    case '/auth/login':
                        response = this.mockLogin(options.body ? JSON.parse(options.body) : {});
                        break;
                    case '/auth/register':
                        response = this.mockRegister(options.body ? JSON.parse(options.body) : {});
                        break;
                    case '/erp/products':
                        response = this.mockGetProducts();
                        break;
                    case '/mola/investments':
                        response = this.mockGetInvestments();
                        break;
                    default:
                        response = {
                            success: false,
                            error: 'Endpoint not found',
                            data: null,
                            status: 404
                        };
                }
                
                resolve(response);
            }, 500); // Simulate network delay
        });
    }

    mockDemoLogin() {
        const demoUser = {
            id: 'demo-user-1',
            email: 'demo@greatnexus.com',
            name: 'Demo User',
            role: 'tenant_admin',
            tenant_id: 'demo-tenant-1'
        };

        const demoToken = 'demo-jwt-token-' + Date.now();

        return {
            success: true,
            data: {
                message: 'Demo login successful!',
                user: demoUser,
                tenant: {
                    id: 'demo-tenant-1',
                    name: 'Great Nexus Demo Company',
                    plan: 'starter'
                },
                accessToken: demoToken,
                refreshToken: demoToken
            },
            error: null,
            status: 200
        };
    }

    mockLogin(credentials) {
        if (credentials.email && credentials.password) {
            const user = {
                id: 'user-' + Date.now(),
                email: credentials.email,
                name: credentials.email.split('@')[0],
                role: 'tenant_admin',
                tenant_id: 'tenant-' + Date.now()
            };

            const token = 'jwt-token-' + Date.now();

            return {
                success: true,
                data: {
                    message: 'Login successful!',
                    user: user,
                    tenant: {
                        id: user.tenant_id,
                        name: 'Minha Empresa',
                        plan: 'starter'
                    },
                    accessToken: token,
                    refreshToken: token
                },
                error: null,
                status: 200
            };
        } else {
            return {
                success: false,
                error: 'Invalid credentials',
                data: null,
                status: 401
            };
        }
    }

    mockRegister(formData) {
        if (formData.email && formData.password && formData.name && formData.companyName) {
            const user = {
                id: 'user-' + Date.now(),
                email: formData.email,
                name: formData.name,
                role: 'tenant_admin',
                tenant_id: 'tenant-' + Date.now()
            };

            const token = 'jwt-token-' + Date.now();

            return {
                success: true,
                data: {
                    message: 'Registration successful!',
                    user: user,
                    tenant: {
                        id: user.tenant_id,
                        name: formData.companyName,
                        plan: 'starter'
                    },
                    accessToken: token,
                    refreshToken: token
                },
                error: null,
                status: 201
            };
        } else {
            return {
                success: false,
                error: 'All fields are required',
                data: null,
                status: 400
            };
        }
    }

    mockGetProducts() {
        const products = [
            {
                id: 'prod-1',
                tenant_id: 'demo-tenant-1',
                sku: 'MON-24-LED',
                name: 'Monitor LED 24"',
                price: 8500.00,
                stock: 15,
                created_at: new Date().toISOString()
            },
            {
                id: 'prod-2',
                tenant_id: 'demo-tenant-1',
                sku: 'TEC-GAMER',
                name: 'Teclado Gamer Mecânico',
                price: 2500.00,
                stock: 8,
                created_at: new Date().toISOString()
            },
            {
                id: 'prod-3',
                tenant_id: 'demo-tenant-1',
                sku: 'MOUSE-WL',
                name: 'Mouse Sem Fios',
                price: 1200.00,
                stock: 25,
                created_at: new Date().toISOString()
            }
        ];

        return {
            success: true,
            data: {
                products: products,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: products.length,
                    pages: 1
                }
            },
            error: null,
            status: 200
        };
    }

    mockGetInvestments() {
        const investments = [
            {
                id: 'inv-1',
                user_id: 'demo-user-1',
                capital: 50000,
                start_date: '2024-01-15',
                business_days: 30,
                daily_rate: 0.003,
                gross_return: 4500,
                tax: 900,
                net_return: 3600,
                status: 'active',
                created_at: new Date().toISOString()
            },
            {
                id: 'inv-2',
                user_id: 'demo-user-1',
                capital: 25000,
                start_date: '2024-02-01',
                business_days: 15,
                daily_rate: 0.003,
                gross_return: 1125,
                tax: 225,
                net_return: 900,
                status: 'active',
                created_at: new Date().toISOString()
            }
        ];

        return {
            success: true,
            data: {
                investments: investments
            },
            error: null,
            status: 200
        };
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
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
        // Add to mock data
        const response = await this.post('/erp/products', productData);
        if (response.success) {
            window.greatNexusApp.showNotification('Produto criado com sucesso!', 'success');
        }
        return response;
    }

    // Great Mola Methods
    async getInvestments() {
        return this.get('/mola/investments');
    }

    async createInvestment(investmentData) {
        const response = await this.post('/mola/investments', investmentData);
        if (response.success) {
            window.greatNexusApp.showNotification('Investimento criado com sucesso!', 'success');
        }
        return response;
    }
}

// Initialize API client
window.ApiClient = ApiClient;
