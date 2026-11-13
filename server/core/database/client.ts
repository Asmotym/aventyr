import { AsyncLocalStorage } from 'node:async_hooks';
import mysql from 'mysql2/promise';
import * as Sentry from '@sentry/node';
import { DatabaseUnavailableError, isDatabaseConnectionError } from './errors';

const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
let connectionLabel: string | null = null;

function setConnectionLabel(value: string | null) {
    connectionLabel = value;
}

export function getDatabaseConnectionLabel(): string | null {
    return connectionLabel;
}

function buildPoolConfig(): mysql.PoolOptions {
    const shared: mysql.PoolOptions = {
        waitForConnections: true,
        connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
        queueLimit: 0,
        connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? 30000),
        timezone: 'Z',
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true
    };

    if (connectionString) {
        const url = new URL(connectionString);
        const sslRequired = process.env.DATABASE_SSL === 'true' || url.searchParams.get('sslmode') === 'require';
        const socketPath = url.searchParams.get('socketPath') ?? undefined;

        const labelHost = socketPath ? `socket ${socketPath}` : `${url.hostname}:${url.port || 3306}`;
        setConnectionLabel(`${labelHost}/${url.pathname.replace(/^\//, '')}`);

        return {
            ...shared,
            host: socketPath ? undefined : url.hostname,
            port: socketPath ? undefined : Number(url.port || 3306),
            socketPath,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, ''),
            ssl: sslRequired ? { rejectUnauthorized: false } : undefined
        };
    }

    const host = process.env.MYSQL_HOST ?? process.env.DATABASE_HOST ?? 'localhost';
    const port = Number(process.env.MYSQL_PORT ?? process.env.DATABASE_PORT ?? 3306);
    const user = process.env.MYSQL_USER ?? process.env.DATABASE_USER;
    const password = process.env.MYSQL_PASSWORD ?? process.env.DATABASE_PASSWORD;
    const database = process.env.MYSQL_DATABASE ?? process.env.DATABASE_NAME;

    if (!user || !database) {
        throw new Error('Missing MySQL configuration. Set DATABASE_URL or MYSQL_* environment variables.');
    }

    const sslRequired = process.env.DATABASE_SSL === 'true';

    setConnectionLabel(`${host}:${port}/${database}`);

    return {
        ...shared,
        host,
        port,
        user,
        password,
        database,
        ssl: sslRequired ? { rejectUnauthorized: false } : undefined
    };
}

const pool = mysql.createPool(buildPoolConfig());
const transactionConnection = new AsyncLocalStorage<mysql.PoolConnection>();
export async function transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (transactionConnection.getStore()) return operation();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await transactionConnection.run(connection, operation);
        await connection.commit();
        return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}

type QueryValues = NonNullable<Parameters<mysql.Pool['query']>[1]>;
type ExecuteValues = NonNullable<Parameters<mysql.Pool['execute']>[1]>;

function formatUnavailableMessage(): string {
    const hint = 'Ensure your MySQL server is running and the DATABASE_URL (or MYSQL_*) variables are correct.';
    return `Unable to connect to the database. ${hint}`;
}

async function withDatabaseHandling<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (isDatabaseConnectionError(error)) {
            const databaseError = error as NodeJS.ErrnoException & { sqlState?: unknown };
            Sentry.addBreadcrumb({
                category: 'database',
                level: 'error',
                message: 'Database dependency unavailable',
                data: {
                    code: databaseError.code,
                    sqlState: typeof databaseError.sqlState === 'string' ? databaseError.sqlState : undefined
                }
            });
            throw new DatabaseUnavailableError(formatUnavailableMessage(), { cause: error });
        }
        throw error;
    }
}

export async function query<T = mysql.RowDataPacket[]>(statement: string, params: QueryValues = []): Promise<T> {
    return withDatabaseHandling(async () => {
        const [rows] = await (transactionConnection.getStore() ?? pool).query(statement, params);
        return rows as T;
    });
}

export async function execute(statement: string, params: ExecuteValues = []): Promise<mysql.ResultSetHeader> {
    return withDatabaseHandling(async () => {
        const [result] = await (transactionConnection.getStore() ?? pool).execute(statement, params);
        return result as mysql.ResultSetHeader;
    });
}

export { pool };
