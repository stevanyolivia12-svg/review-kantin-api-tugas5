import type { NodeMsSqlDatabase, NodeMsSqlTransaction } from 'drizzle-orm/node-mssql';

export type DbExecutor = NodeMsSqlDatabase | NodeMsSqlTransaction;
