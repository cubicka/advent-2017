import express from 'express'

export function AllowAJAX(options: {[x: string]: any}) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        function IsOriginAllowed(origin: string) {
            return options.origins.indexOf(origin) > -1
        }

        // Website you wish to allow to connect
        const originHeader = req.header('origin') || ''
        if (options && options.origins && IsOriginAllowed(originHeader)) {
            res.setHeader('Access-Control-Allow-Origin', originHeader)
        }

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,X-Access-Token')

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        if (options.allowCredential === true) {
            res.setHeader('Access-Control-Allow-Credentials', options.allowCredential)
        }

        // Pass to next layer of middleware
        next()
    }
}

export function ResponseAPI(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.send500 = (message = 'Server error.') => {
        res.status(500).send({message})
    }

    res.send403 = (message = 'Forbidden.') => {
        res.status(403).send({message})
    }

    res.send401 = (message = 'Invalid request.') => {
        res.status(401).send({message})
    }

    res.send400 = (message = 'Bad request.') => {
        res.status(400).send({message})
    }

    next()
}
