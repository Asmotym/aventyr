import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

/** Isolated local database; never use DATABASE_URL as an integration-test target. */
export async function createTestDatabase(feature: string) {
    config();
    const database = `aventyr_${feature.replace(/[^a-z0-9]/gi, '_')}_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(`mysql://root@127.0.0.1:${process.env.MYSQL_PORT || 3306}/${database}`);
    const password = process.env.MYSQL_ROOT_PASSWORD || 'root';
    url.password = password;
    const admin = await createConnection({
        host: '127.0.0.1', port: Number(url.port || 3306), user: 'root', password,
    });
    try {
        await admin.query(`CREATE DATABASE \`${database}\``);
        process.env.DATABASE_URL = url.toString();
        process.env.DATABASE_SSL = 'false';
        return { admin, database };
    } catch (error) {
        await admin.end();
        throw error;
    }
}
