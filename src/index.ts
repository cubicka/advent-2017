import * as http from 'http';
import app from './server';
import { SimpleDate } from './util/date';

const port = normalizePort(process.env.PORT || '3001');

const server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// tslint:disable-next-line:no-console
console.log(`${SimpleDate(new Date())}, listen to ${port}`);

function normalizePort(val: string) {
    const normalizedPort = parseInt(val, 10);

    if (isNaN(normalizedPort)) {
        return val;
    }

    if (normalizedPort >= 0) {
        return normalizedPort;
    }

    return false;
}

function onError(error: Error) {
    throw error;

    // if (error.syscall !== 'listen') {
    //     throw error;
    // }

    // var bind = typeof port === 'string'
    //     ? 'Pipe ' + port
    //     : 'Port ' + port;

    // switch (error.code) {
    //     case 'EACCES':
    //         console.error(bind + ' requires elevated privileges');
    //         process.exit(1);
    //         break;
    //     case 'EADDRINUSE':
    //         console.error(bind + ' is already in use');
    //         process.exit(1);
    //         break;
    //     default:
    //         throw error;
    // }
}

function onListening() {
    // var addr = server.address();
    // var bind = typeof addr === 'string'
    //     ? 'pipe ' + addr
    //     : 'port ' + addr.port;
}

process.on('message', msg => {
    if (msg === 'shutdown') {
        server.close(() => {
            process.exit(0);
        });
        setTimeout(() => {
            process.exit(0);
        }, 30 * 1000);
    }
});
