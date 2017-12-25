import { Middleware } from '../middleware/auth';

export default {
    use: [Middleware('seller'), '/account', '/orders', '/retail', '/sku'],
};
