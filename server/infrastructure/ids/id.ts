import { randomBytes, randomUUID } from 'crypto';
export function createRoomId(): string {
    return randomUUID();
}
export function createMessageId(): string {
    return randomUUID();
}
export function generateInviteCode(length = 8): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    while (code.length < length) {
        const byte = randomBytes(1)[0];
        const index = byte % alphabet.length;
        code += alphabet[index];
    }
    return code;
}
export function generateArticleUid(length = 10): string {
    return generateInviteCode(length);
}
