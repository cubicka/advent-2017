import * as session from 'express-session'
// const session = require('express-session')
const MemoryStore = require('express-session/session/memory')
const session_store = new MemoryStore()
const config = require('../config.json')

export default session({
    secret: 'expecto patronum!',
    resave: false,
    saveUninitialized: true,
    name: 'quoVadis?',
    store: session_store,
    cookie: {
        secure: config.isSecure,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 14
    }
})
