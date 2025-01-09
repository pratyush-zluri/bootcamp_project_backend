import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import * as dotenv from 'dotenv'
import { Transaction } from './src/entities/transactions';
dotenv.config()

const config = {
    driver: PostgreSqlDriver,
  entities: [Transaction],
  dbName: process.env.dbName,
  user: process.env.user,
  password: process.env.password,
  host: process.env.host,
  port: 5432,
  migrations: {
    path: './migrations',
    pathTs: './src/migrations',
    glob: '!(*.d).{js,ts}',
  },
  driverOptions: {
    connection: {
      ssl: true,
    },
  },
};


export default config;
