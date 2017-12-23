import * as express from 'express';
import { IsArray } from '../util/obj';

function Reify(path: string) {
    const routeSpecs = require(path).default;

    const router: {[x: string]: any} = express.Router();
    if ('use' in routeSpecs) {
        routeSpecs.use.forEach((name: string) => {
            if (typeof name === 'function') {
                router.use(name);
                return;
            }

            const childRouter = Reify(path + name);
            router.use(name, childRouter);
        });
    }

    const httpOps = ['get', 'post'];
    httpOps.forEach(ops => {
        if (ops in routeSpecs) {
            const specs = routeSpecs[ops];
            if (IsArray(specs[0])) {
                specs.forEach((spec: any[]) => {
                    router[ops](...spec);
                });
            } else {
                router[ops](...specs);
            }
        }
    });

    return router as express.Router;
}

// const ReifiedRouter = Reify('../routes')
export default Reify('../routes');
