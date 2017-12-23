import { Middleware } from '../middleware/auth';

export default {
    use: [Middleware, '/orders', '/retail'],
};
