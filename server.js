const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// CREATE FRONTEND IF NOT EXISTS
// =============================================

const ensureFrontendExists = () => {
  const frontendPath = path.join(__dirname, 'frontend');
  const srcPath = path.join(frontendPath, 'src');
  const stylesPath = path.join(srcPath, 'styles');
  const jsPath = path.join(srcPath, 'js');
  const apiPath = path.join(jsPath, 'api');
  const modulesPath = path.join(jsPath, 'modules');

  // Create directories
  [frontendPath, srcPath, stylesPath, jsPath, apiPath, modulesPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('✅ Created directory:', dir);
    }
  });

  // Create index.html if it doesn't exist
  const indexHtmlPath = path.join(frontendPath, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    const indexHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Great Nexus - Ecossistema Empresarial Inteligente</title>
    <link rel="stylesheet" href="src/styles/main.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="app">
        <!-- Loading Screen -->
        <div id="loading-screen" class="loading-screen">
            <div class="loading-content">
                <div class="logo">
                    <i class="fas fa-network-wired"></i>
                    <span>Great Nexus</span>
                </div>
                <div class="loading-spinner"></div>
                <p>Inicializando ecossistema empresarial...</p>
            </div>
        </div>

        <!-- Auth Screens -->
        <div id="auth-screens">
            <!-- Login Screen -->
            <div id="login-screen" class="auth-screen">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="logo">
                            <i class="fas fa-network-wired"></i>
                            <span>Great Nexus</span>
                        </div>
                        <h1>Bem-vindo de volta</h1>
                        <p>Entre na sua conta para continuar</p>
                    </div>

                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label for="login-email">Email</label>
                            <input type="email" id="login-email" required placeholder="seu@email.com">
                        </div>

                        <div class="form-group">
                            <label for="login-password">Password</label>
                            <input type="password" id="login-password" required placeholder="Sua password">
                        </div>

                        <div class="form-options">
                            <label class="checkbox">
                                <input type="checkbox" id="remember-me">
                                <span>Lembrar-me</span>
                            </label>
                            <a href="#" class="forgot-password">Esqueceu a password?</a>
                        </div>

                        <button type="submit" class="btn btn-primary btn-full">
                            <i class="fas fa-sign-in-alt"></i>
                            Entrar
                        </button>

                        <div class="demo-section">
                            <div class="divider">ou</div>
                            <button type="button" id="demo-login-btn" class="btn btn-outline btn-full">
                                <i class="fas fa-rocket"></i>
                                Entrar com Demo
                            </button>
                        </div>
                    </form>

                    <div class="auth-footer">
                        <p>Não tem uma conta? <a href="#" id="show-register">Registe-se</a></p>
                    </div>
                </div>

                <div class="auth-background">
                    <div class="background-content">
                        <h2>Ecossistema Empresarial Inteligente</h2>
                        <p>Integre ERP, CRM, MRP, B2B Marketplace e Fintech numa única plataforma</p>
                        <div class="features">
                            <div class="feature">
                                <i class="fas fa-cube"></i>
                                <span>Gestão Completa</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-chart-line"></i>
                                <span>Business Intelligence</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-handshake"></i>
                                <span>Marketplace B2B</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Register Screen -->
            <div id="register-screen" class="auth-screen hidden">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="logo">
                            <i class="fas fa-network-wired"></i>
                            <span>Great Nexus</span>
                        </div>
                        <h1>Criar Nova Conta</h1>
                        <p>Comece sua jornada empresarial connosco</p>
                    </div>

                    <form id="register-form" class="auth-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="register-name">Nome Completo</label>
                                <input type="text" id="register-name" required placeholder="Seu nome">
                            </div>
                            <div class="form-group">
                                <label for="register-company">Nome da Empresa</label>
                                <input type="text" id="register-company" required placeholder="Nome da empresa">
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="register-email">Email</label>
                            <input type="email" id="register-email" required placeholder="seu@empresa.com">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="register-password">Password</label>
                                <input type="password" id="register-password" required placeholder="Mínimo 8 caracteres">
                            </div>
                            <div class="form-group">
                                <label for="register-confirm-password">Confirmar Password</label>
                                <input type="password" id="register-confirm-password" required placeholder="Repita a password">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="register-country">País</label>
                                <select id="register-country" required>
                                    <option value="">Selecione o país</option>
                                    <option value="MZ" selected>Moçambique</option>
                                    <option value="AO">Angola</option>
                                    <option value="PT">Portugal</option>
                                    <option value="BR">Brasil</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="register-currency">Moeda</label>
                                <select id="register-currency" required>
                                    <option value="">Selecione a moeda</option>
                                    <option value="MZN" selected>MZN - Metical</option>
                                    <option value="USD">USD - Dólar Americano</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-options">
                            <label class="checkbox">
                                <input type="checkbox" id="accept-terms" required>
                                <span>Concordo com os <a href="#">Termos de Serviço</a> e <a href="#">Política de Privacidade</a></span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary btn-full">
                            <i class="fas fa-user-plus"></i>
                            Criar Conta
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p>Já tem uma conta? <a href="#" id="show-login">Entrar</a></p>
                    </div>
                </div>

                <div class="auth-background">
                    <div class="background-content">
                        <h2>Comece sua Transformação Digital</h2>
                        <p>Tudo o que sua empresa precisa num único ecossistema integrado</p>
                        <div class="features">
                            <div class="feature">
                                <i class="fas fa-store"></i>
                                <span>ERP & Vendas</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-industry"></i>
                                <span>Produção (MRP)</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-wallet"></i>
                                <span>Great Mola</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Application -->
        <div id="main-app" class="main-app hidden">
            <!-- Sidebar -->
            <nav class="sidebar">
                <div class="sidebar-header">
                    <div class="logo">
                        <i class="fas fa-network-wired"></i>
                        <span>Great Nexus</span>
                    </div>
                    <button id="sidebar-toggle" class="sidebar-toggle">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>

                <div class="sidebar-content">
                    <div class="tenant-info">
                        <div class="tenant-avatar">
                            <i class="fas fa-building"></i>
                        </div>
                        <div class="tenant-details">
                            <span class="tenant-name" id="current-tenant">Minha Empresa</span>
                            <span class="tenant-plan">Plano Starter</span>
                        </div>
                    </div>

                    <ul class="sidebar-menu">
                        <li class="menu-item active" data-module="dashboard">
                            <a href="#">
                                <i class="fas fa-home"></i>
                                <span>Dashboard</span>
                            </a>
                        </li>
                        
                        <li class="menu-section">ERP & Gestão</li>
                        <li class="menu-item" data-module="products">
                            <a href="#">
                                <i class="fas fa-cube"></i>
                                <span>Produtos</span>
                            </a>
                        </li>
                        <li class="menu-item" data-module="sales">
                            <a href="#">
                                <i class="fas fa-shopping-cart"></i>
                                <span>Vendas</span>
                            </a>
                        </li>
                        <li class="menu-item" data-module="inventory">
                            <a href="#">
                                <i class="fas fa-warehouse"></i>
                                <span>Inventário</span>
                            </a>
                        </li>

                        <li class="menu-section">Great Mola</li>
                        <li class="menu-item" data-module="investments">
                            <a href="#">
                                <i class="fas fa-chart-line"></i>
                                <span>Investimentos</span>
                            </a>
                        </li>
                    </ul>
                </div>

                <div class="sidebar-footer">
                    <div class="user-menu">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <span class="user-name" id="current-user">Utilizador</span>
                            <span class="user-role">Administrador</span>
                        </div>
                    </div>
                </div>
            </nav>

            <!-- Main Content -->
            <main class="main-content">
                <!-- Header -->
                <header class="content-header">
                    <div class="header-left">
                        <h1 id="page-title">Dashboard</h1>
                        <div class="breadcrumb">
                            <span>Great Nexus</span>
                            <i class="fas fa-chevron-right"></i>
                            <span id="breadcrumb-current">Dashboard</span>
                        </div>
                    </div>

                    <div class="header-right">
                        <div class="quick-stats">
                            <div class="stat-item">
                                <span class="stat-label">Vendas Hoje</span>
                                <span class="stat-value">12.540 MZN</span>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- Content Area -->
                <div class="content-area">
                    <!-- Dashboard Module -->
                    <div id="dashboard-module" class="module-content">
                        <div class="dashboard-grid">
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-icon primary">
                                        <i class="fas fa-chart-line"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>125.840 MZN</h3>
                                        <p>Vendas do Mês</p>
                                    </div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-icon success">
                                        <i class="fas fa-shopping-cart"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>42</h3>
                                        <p>Novos Pedidos</p>
                                    </div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-icon warning">
                                        <i class="fas fa-cube"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>156</h3>
                                        <p>Produtos em Stock</p>
                                    </div>
                                </div>

                                <div class="stat-card">
                                    <div class="stat-icon info">
                                        <i class="fas fa-wallet"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>89.250 MZN</h3>
                                        <p>Great Mola</p>
                                    </div>
                                </div>
                            </div>

                            <div class="quick-actions-grid">
                                <div class="card">
                                    <div class="card-header">
                                        <h3>Ações Rápidas</h3>
                                    </div>
                                    <div class="card-body">
                                        <div class="actions-grid">
                                            <button class="action-btn" data-action="new-product">
                                                <i class="fas fa-cube"></i>
                                                <span>Add Produto</span>
                                            </button>
                                            <button class="action-btn" data-action="new-investment">
                                                <i class="fas fa-chart-line"></i>
                                                <span>Investir</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Products Module -->
                    <div id="products-module" class="module-content hidden">
                        <div class="module-header">
                            <h2>Gestão de Produtos</h2>
                            <button class="btn btn-primary" id="new-product-btn">
                                <i class="fas fa-plus"></i>
                                Novo Produto
                            </button>
                        </div>
                        <div class="products-container">
                            <div class="empty-state">
                                <i class="fas fa-cube"></i>
                                <h3>Módulo de Produtos</h3>
                                <p>Use o botão "Add Produto" para começar</p>
                            </div>
                        </div>
                    </div>

                    <!-- Investments Module -->
                    <div id="investments-module" class="module-content hidden">
                        <div class="module-header">
                            <h2>Great Mola - Investimentos</h2>
                            <button class="btn btn-primary" id="new-investment-btn">
                                <i class="fas fa-plus"></i>
                                Novo Investimento
                            </button>
                        </div>
                        <div class="investments-container">
                            <div class="empty-state">
                                <i class="fas fa-chart-line"></i>
                                <h3>Módulo de Investimentos</h3>
                                <p>Use o botão "Investir" para começar</p>
                            </div>
                        </div>
                    </div>

                    <!-- Other modules -->
                    <div id="sales-module" class="module-content hidden">
                        <div class="module-header">
                            <h2>Gestão de Vendas</h2>
                        </div>
                        <div class="empty-state">
                            <i class="fas fa-shopping-cart"></i>
                            <h3>Módulo de Vendas</h3>
                            <p>Em desenvolvimento</p>
                        </div>
                    </div>

                    <div id="inventory-module" class="module-content hidden">
                        <div class="module-header">
                            <h2>Gestão de Inventário</h2>
                        </div>
                        <div class="empty-state">
                            <i class="fas fa-warehouse"></i>
                            <h3>Módulo de Inventário</h3>
                            <p>Em desenvolvimento</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <script src="src/js/app.js"></script>
    <script src="src/js/auth.js"></script>
    <script src="src/js/api/client.js"></script>
</body>
</html>`;
    fs.writeFileSync(indexHtmlPath, indexHtml);
    console.log('✅ Created index.html');
  }

  // Create main.css if it doesn't exist
  const mainCssPath = path.join(stylesPath, 'main.css');
  if (!fs.existsSync(mainCssPath)) {
    const mainCss = `/* Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary-color: #2563eb;
    --primary-dark: #1d4ed8;
    --secondary-color: #64748b;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
    --info-color: #3b82f6;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #334155;
    --gray-800: #1e293b;
    --gray-900: #0f172a;
    --font-family: 'Inter', sans-serif;
    --radius: 0.5rem;
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

body {
    font-family: var(--font-family);
    background-color: var(--gray-50);
    color: var(--gray-800);
    line-height: 1.5;
}

.hidden {
    display: none !important;
}

/* Loading Screen */
.loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.loading-content {
    text-align: center;
    color: white;
}

.loading-content .logo {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
}

.loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Auth Screens */
.auth-screen {
    display: flex;
    min-height: 100vh;
}

.auth-container {
    flex: 1;
    max-width: 480px;
    padding: 2rem;
    background: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.auth-header {
    text-align: center;
    margin-bottom: 2rem;
}

.auth-header .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.auth-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.auth-form {
    margin-bottom: 1.5rem;
}

.form-group {
    margin-bottom: 1rem;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

input, select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--gray-300);
    border-radius: var(--radius);
    font-size: 1rem;
}

input:focus, select:focus {
    outline: none;
    border-color: var(--primary-color);
}

.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
}

.btn-outline {
    background: transparent;
    border: 1px solid var(--gray-300);
}

.btn-outline:hover {
    background: var(--gray-50);
}

.btn-full {
    width: 100%;
    justify-content: center;
}

.demo-section {
    margin-top: 1rem;
}

.divider {
    text-align: center;
    margin: 1rem 0;
    color: var(--gray-400);
}

.auth-background {
    flex: 1;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.features {
    display: grid;
    gap: 1rem;
}

.feature {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

/* Main App */
.main-app {
    display: flex;
    min-height: 100vh;
}

.sidebar {
    width: 280px;
    background: white;
    border-right: 1px solid var(--gray-200);
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--gray-200);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.sidebar-header .logo {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--primary-color);
}

.tenant-info {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid var(--gray-200);
}

.tenant-avatar {
    width: 40px;
    height: 40px;
    background: var(--primary-color);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.sidebar-menu {
    list-style: none;
    padding: 1rem 0;
}

.menu-section {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--gray-500);
    text-transform: uppercase;
}

.menu-item a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--gray-700);
    text-decoration: none;
    border-radius: var(--radius);
    margin: 0 0.25rem;
}

.menu-item.active a {
    background: var(--primary-color);
    color: white;
}

.sidebar-footer {
    margin-top: auto;
    padding: 1rem;
    border-top: 1px solid var(--gray-200);
}

.user-menu {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.user-avatar {
    width: 32px;
    height: 32px;
    background: var(--gray-300);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Main Content */
.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.content-header {
    background: white;
    border-bottom: 1px solid var(--gray-200);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.content-area {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
}

.module-content {
    animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Dashboard */
.dashboard-grid {
    display: grid;
    gap: 1.5rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
}

.stat-card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-200);
    display: flex;
    align-items: center;
    gap: 1rem;
}

.stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}

.stat-icon.primary {
    background: rgba(37, 99, 235, 0.1);
    color: var(--primary-color);
}

.stat-icon.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
}

.stat-icon.warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.stat-icon.info {
    background: rgba(59, 130, 246, 0.1);
    color: var(--info-color);
}

.quick-actions-grid {
    grid-column: 1 / -1;
}

.card {
    background: white;
    border-radius: 1rem;
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-200);
}

.card-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--gray-200);
}

.card-body {
    padding: 1.5rem;
}

.actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    background: var(--gray-50);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
}

.action-btn:hover {
    background: white;
    border-color: var(--primary-color);
}

.action-btn i {
    font-size: 1.5rem;
    color: var(--primary-color);
}

/* Module Header */
.module-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--gray-500);
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.empty-state h3 {
    margin-bottom: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
    .auth-screen {
        flex-direction: column;
    }
    
    .auth-container {
        max-width: none;
    }
    
    .auth-background {
        display: none;
    }
    
    .form-row {
        grid-template-columns: 1fr;
    }
    
    .sidebar {
        width: 80px;
    }
    
    .sidebar-header .logo span,
    .tenant-details,
    .menu-item span,
    .menu-section {
        display: none;
    }
}`;
    fs.writeFileSync(mainCssPath, mainCss);
    console.log('✅ Created main.css');
  }

  // Create JavaScript files
  const jsFiles = {
    'app.js': `// Great Nexus - Main Application
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
        this.hideAllScreens();
        document.getElementById('auth-screens').classList.remove('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }

    showMainApp() {
        this.hideAllScreens();
        document.getElementById('main-app').classList.remove('hidden');
        this.updateUserInterface();
    }

    hideAllScreens() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screens').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
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
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('register-screen').classList.remove('hidden');
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        });

        // Demo login
        document.getElementById('demo-login-btn')?.addEventListener('click', () => {
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

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    async handleDemoLogin() {
        try {
            const response = await this.apiClient.post('/auth/demo', {});
            
            if (response.success) {
                this.storeAuthData(response.data);
                this.showMainApp();
                this.showNotification('Login demo realizado com sucesso!', 'success');
            }
        } catch (error) {
            this.showNotification('Erro de conexão', 'error');
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
        document.querySelector(\`[data-module="\${moduleName}"]\`).classList.add('active');

        // Hide all modules
        document.querySelectorAll('.module-content').forEach(module => {
            module.classList.add('hidden');
        });

        // Show target module
        const targetModule = document.getElementById(\`\${moduleName}-module\`);
        if (targetModule) {
            targetModule.classList.remove('hidden');
        }

        this.updatePageTitle(moduleName);
        this.currentModule = moduleName;
    }

    updatePageTitle(moduleName) {
        const titles = {
            dashboard: 'Dashboard',
            products: 'Produtos',
            sales: 'Vendas',
            inventory: 'Inventário',
            investments: 'Investimentos'
        };

        const title = titles[moduleName] || 'Great Nexus';
        document.getElementById('page-title').textContent = title;
        document.getElementById('breadcrumb-current').textContent = title;
    }

    handleQuickAction(action) {
        const actions = {
            'new-product': () => this.showNotification('Criar produto - em desenvolvimento', 'info'),
            'new-investment': () => this.showNotification('Novo investimento - em desenvolvimento', 'info')
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    showNotification(message, type = 'info') {
        alert(\`\${type.toUpperCase()}: \${message}\`);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1000);

    window.greatNexusApp = new GreatNexusApp();
});`,
    'auth.js': `// Authentication handling
class AuthManager {
    constructor() {
        this.apiClient = new ApiClient();
        this.setupAuthForms();
    }

    setupAuthForms() {
        // Login form
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('register-form')?.addEventListener('submit', (e) => {
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
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
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

        if (formData.password !== document.getElementById('register-confirm-password').value) {
            window.greatNexusApp.showNotification('As passwords não coincidem', 'error');
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
            window.greatNexusApp.showNotification('Erro de conexão', 'error');
        }
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});`,
    'api/client.js': `// API Client for Great Nexus
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

        if (this.token) {
            config.headers.Authorization = \`Bearer \${this.token}\`;
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
                error: 'Network error',
                status: 0
            };
        }
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
}

// Initialize API client
window.ApiClient = ApiClient;`
  };

  Object.entries(jsFiles).forEach(([filename, content]) => {
    const filePath = path.join(jsPath, filename);
    if (filename.includes('/')) {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
      console.log(\`✅ Created \${filename}\`);
    }
  });

  console.log('🎉 Frontend structure created successfully!');
};

// Initialize frontend on startup
ensureFrontendExists();

// =============================================
// MIDDLEWARE CONFIGURATION
// =============================================

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// =============================================
// STATIC FILES SERVING
// =============================================

app.use(express.static(path.join(__dirname, 'frontend')));

// =============================================
// HEALTH CHECK & STATUS ENDPOINTS
// =============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Great Nexus',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    message: '🚀 Servidor está funcionando perfeitamente!'
  });
});

app.get('/status', (req, res) => {
  res.json({
    message: 'Great Nexus API Server',
    status: 'operational',
    version: '1.0.0',
    endpoints: {
      auth: ['/api/v1/auth/demo', '/api/v1/auth/login', '/api/v1/auth/register'],
      health: '/health'
    }
  });
});

// =============================================
// AUTHENTICATION ROUTES
// =============================================

app.post('/api/v1/auth/demo', (req, res) => {
  const demoUser = {
    id: 'demo-user-1',
    email: 'demo@greatnexus.com',
    name: 'Demo User',
    role: 'tenant_admin',
    tenant_id: 'demo-tenant-1'
  };

  const demoToken = 'demo-jwt-token-' + Date.now();

  res.json({
    message: 'Demo login successful!',
    user: demoUser,
    tenant: {
      id: 'demo-tenant-1',
      name: 'Great Nexus Demo Company',
      plan: 'starter',
      country: 'MZ',
      currency: 'MZN'
    },
    accessToken: demoToken,
    refreshToken: demoToken
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = {
    id: 'user-' + Date.now(),
    email: email,
    name: email.split('@')[0],
    role: 'tenant_admin',
    tenant_id: 'tenant-' + Date.now()
  };

  const token = 'jwt-token-' + Date.now();

  res.json({
    message: 'Login successful!',
    user: user,
    tenant: {
      id: user.tenant_id,
      name: 'Minha Empresa',
      plan: 'starter',
      country: 'MZ',
      currency: 'MZN'
    },
    accessToken: token,
    refreshToken: token
  });
});

app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, name, companyName, country = 'MZ', currency = 'MZN' } = req.body;

  if (!email || !password || !name || !companyName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const user = {
    id: 'user-' + Date.now(),
    email: email,
    name: name,
    role: 'tenant_admin',
    tenant_id: 'tenant-' + Date.now()
  };

  const token = 'jwt-token-' + Date.now();

  res.status(201).json({
    message: 'Registration successful!',
    user: user,
    tenant: {
      id: user.tenant_id,
      name: companyName,
      plan: 'starter',
      country: country,
      currency: currency
    },
    accessToken: token,
    refreshToken: token
  });
});

// =============================================
// CATCH-ALL ROUTE FOR SPA
// =============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// =============================================
// ERROR HANDLING
// =============================================

app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// =============================================
// SERVER STARTUP
// =============================================

app.listen(PORT, () => {
  console.log(\`
🎉 GREAT NEXUS SERVER STARTED SUCCESSFULLY!

📍 Port: \${PORT}
🌍 Environment: \${process.env.NODE_ENV || 'production'}
📅 Started: \${new Date().toLocaleString()}
🔗 Health Check: http://localhost:\${PORT}/health
🚀 Demo Login: POST http://localhost:\${PORT}/api/v1/auth/demo

✅ SERVER READY - Frontend auto-generated!
  \`);
});

module.exports = app;
