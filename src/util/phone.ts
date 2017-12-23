export function Normalize(phone: string) {
    let clean = phone.substr(0, phone.length);

    if (clean[0] === '0') {
        clean = clean.substr(1);
    }

    if (clean[0] === '+') {
        clean = clean.substr(1);
    }

    if (clean.startsWith('62')) {
        clean = clean.substr(2);
    }

    return clean;
}
