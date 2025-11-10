import { Router } from 'express';
import { z } from 'zod';
import { register, login, refreshToken, logout } from '../controllers/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    companyName: z.string().min(2),
    country: z.string().min(2),
    currency: z.string().length(3)
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string()
  })
});

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
