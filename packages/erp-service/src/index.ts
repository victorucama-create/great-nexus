import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import productRoutes from './routes/products';
import invoiceRoutes from './routes/invoices';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/erp/products', authenticateToken, productRoutes);
app.use('/api/v1/erp/invoices', authenticateToken, invoiceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'erp-service' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ERP service running on port ${PORT}`);
});
