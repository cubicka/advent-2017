import { Middleware } from '../middleware/auth';

export default {
    use: [Middleware('buyer'), '/orders', '/ws'],
};
