import * as bodyParser from 'body-parser'
import * as cookieParser from 'cookie-parser'
import * as express from 'express'
import * as expressValidator from 'express-validator'
import * as helmet from 'helmet'
// import * as  from 'parsetrace'
// import * as config from '../config.json'
import {AllowAJAX, ResponseAPI} from './helper'
import sessionMiddleware from './session'
import routes from './route-reify'

const config = require('../config.json')

let app = express()

app.set('port', 3001)
app.set('trust proxy', 1)

app.use(helmet())
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
app.use(expressValidator())
app.use(cookieParser())

app.use(sessionMiddleware)

// allow ajax request
app.use(AllowAJAX({
    origins: config.domain.seller + config.domain.buyer,
    allowCredential: true,
}))

app.use(ResponseAPI)

// application route, exclude method OPTIONS
app.use('/', (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.send()
    } else {
        req.kulakan = {}
        next()
    }
})

app.use(routes)

// catch 404 and forward to error handler
app.use((req, res, next) => {
    var err = new Error('Not Found')
    res.status(404)
    next(err)
})

// error handlers
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!res.statusCode)
        res.status(500)

    res.send(err.message)
})

export default app
