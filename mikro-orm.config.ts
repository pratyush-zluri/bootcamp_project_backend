import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import * as dotenv from 'dotenv'
import { Transaction } from './src/entities/transactions';
dotenv.config()

const config = {
  driver: PostgreSqlDriver,
  entities: [Transaction],
  clientUrl: 'postgresql://trans_db_owner:lod7tvRG9Djq@ep-lively-cherry-a5xwvy1y.us-east-2.aws.neon.tech/trans_db?sslmode=require',
  // dbName: process.env.dbName,
  // user: process.env.user,
  // password: process.env.password,
  // host: process.env.host,
  // port: 5432,
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
