import { Router } from 'express';
import { z } from 'zod';
import { 
  getProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '../controllers/products';
import { validateRequest } from '../middleware/validation';

const router = Router();

const productSchema = z.object({
  body: z.object({
    company_id: z.string().uuid(),
    sku: z.string().min(1),
    name: z.string().min(1),
    price: z.number().min(0),
    stock: z.number().int().min(0)
  })
});

router.get('/', getProducts);
router.post('/', validateRequest(productSchema), createProduct);
router.put('/:id', validateRequest(productSchema), updateProduct);
router.delete('/:id', deleteProduct);

export default router;
