declare module "*.json" {
    const value: any;
    export default value;
}

declare module "express-session/session/memory" {
    const value: any;
    export default value;
}

declare module "nexmo" {
    const value: any;
    export default value;
}

declare module "parsetrace" {
    const value: any;
    export default value;
}

declare namespace Express {
    interface Request {
        kulakan: {
            [x: string]: any,
        };
    }

    interface Response {
        send400: (message?: string) => void;
        send401: (message?: string) => void;
        send403: (message?: string) => void;
        send500: (message?: string) => void;
    }
}
