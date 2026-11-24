export interface TransactionConnection {
    beginTransaction(): Promise<unknown>;
    commit(): Promise<unknown>;
    rollback(): Promise<unknown>;
    release(): void;
}
/** Own one connection lease. Callers retain their SQL and lock ordering. */
export async function runTransaction<T, Connection extends TransactionConnection>(connection: Connection, operation: (connection: Connection) => Promise<T>): Promise<T> {
    try {
        await connection.beginTransaction();
        const result = await operation(connection);
        await connection.commit();
        return result;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
