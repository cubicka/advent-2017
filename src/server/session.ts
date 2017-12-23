import * as session from 'express-session';
import * as MemoryStore from 'express-session/session/memory';

import * as config from '../config.json';

const sessionStore = new MemoryStore();

export default session({
    secret: 'expecto patronum!',
    resave: false,
    saveUninitialized: true,
    name: 'quoVadis?',
    store: sessionStore,
    cookie: {
        secure: config.isSecure,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 14,
    },
});
