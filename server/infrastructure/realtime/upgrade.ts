export function rejectUpgrade(socket: NodeJS.WritableStream, status: number, message: string): void {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    if ('destroy' in socket && typeof socket.destroy === 'function') {
        socket.destroy();
    }
}
