import express from 'express';

function ValidationArray(specs: any[]): (x: any[]) => boolean {
    return (arr: any[]) => {
        if (Object.prototype.toString.call(arr) !== '[object Array]') return false;
        if (specs.length === 0) return true;

        return arr.reduce((isValidated, obj, idx) => {
            if (isValidated === false) return false;

            const fn = idx >= specs.length ? Validation(specs[specs.length - 1]) : Validation(specs[idx]);
            return fn(obj);
        }, true);
    };
}

function ValidationObj(specs: {[x: string]: any}): (x: {[x: string]: any}) => boolean {
    return obj => {
        if (typeof obj !== 'object') return false;
        if (!specs) return true;

        return Object.keys(specs).reduce((isValidated, attr) => {
            if (isValidated === false) return false;
            return Validation(specs[attr])(obj[attr]);
        }, true);
    };
}

export function Validation(specs: any): (x: any) => boolean {
    if (typeof specs === 'function') {
        return specs;
    } else if (Object.prototype.toString.call(specs) === '[object Array]') {
        return ValidationArray(specs);
    } else if (typeof specs === 'object') {
        return ValidationObj(specs);
    }

    return () => true;
}

// export function Complement(fn) {
//     return (...args) => (!(fn(...args)))
// }

export function ComposeOr(...specs: any[]): (x: any) => boolean {
    return (obj: any) => {
        if (specs.length === 0) return true;

        return specs.reduce((result, spec) => {
            if (result === true) return true;

            const fn = Validation(spec);
            return fn(obj);
        }, false);
    };
}

export function IsNumber(x: number): boolean {
    return (typeof x === 'number') && !isNaN(x);
}

export function IsOptional(specs: any) {
    return (obj: any) => {
        if (obj === undefined) return true;
        return Validation(specs)(obj);
    };
}

export function IsOptionalOrNull(specs: any) {
    return (obj: any) => {
        if (obj === undefined || obj === null) return true;
        return Validation(specs)(obj);
    };
}

export function IsParseDate(s: string): boolean {
    const d = new Date(s);
    return (Object.prototype.toString.call(d) === '[object Date]') && !(isNaN(d.getTime()));
}

export function IsParseNumber(x: string): boolean {
    if (typeof x === 'string') {
        return IsNumber(parseFloat(x));
    }

    return IsNumber(x);
}

export function IsPhone(phone: string) {
    const regexPhone =
        /^[+]?([\d]{3}(-| )?[\d]{3}(-| )?[\d]{4}|[\d]{5,12}|}|[(][\d]{3}[)](-| )?[\d]{3}(-| )?[\d]{4})$/;
    return IsString(phone) && regexPhone.test(phone);
}

export function IsString(s: string): boolean {
    return typeof s === 'string';
}

export function Middleware(specs: any) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const fn = Validation(specs);
        if (fn(req)) {
            return next();
        }

        res.send400();
    };
}

// export function IsNull(x) {
//     return x === null
// }

export function IsBool(x: boolean) {
    return x === true || x === false;
}
