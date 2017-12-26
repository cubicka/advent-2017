import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as expressValidator from 'express-validator';
import * as helmet from 'helmet';

import * as config from '../config.json';
import { SimpleDate } from '../util/date';

import {AllowAJAX, ResponseAPI} from './helper';
import routes from './route-reify';
import sessionMiddleware from './session';

const app = express();

app.set('port', 3001);
app.set('trust proxy', 1);

app.use(helmet());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(expressValidator());
app.use(cookieParser());

app.use(sessionMiddleware);

// allow ajax request
app.use(AllowAJAX({
    origins: config.domain.seller + config.domain.buyer,
    allowCredential: true,
}));

app.use(ResponseAPI);

// application route, exclude method OPTIONS
app.use('/', (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.send();
    } else {
        req.kulakan = {};
        next();
    }
});

app.use(routes);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    res.status(404);
    next(err);
});

// error handlers
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.statusCode === 200) res.status(400);

    // tslint:disable-next-line:no-console
    console.log('error:', `${SimpleDate(new Date())}`, req.path, err.message);
    // tslint:disable-next-line:no-console
    console.log('error header', req.headers);
    // tslint:disable-next-line:no-console
    console.log('error body', req.body);
    // tslint:disable-next-line:no-console
    console.log('error query', req.query);
    // tslint:disable-next-line:no-console
    console.log('error params', req.params);
    // tslint:disable-next-line:no-console
    console.log('error stack', err.stack);
    // tslint:disable-next-line:no-console
    console.log();

    res.send({ error: err.message });
});

export default app;
