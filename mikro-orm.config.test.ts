import { Options } from '@mikro-orm/core';
import { Transaction } from './src/entities/transactions';

const testConfig: Options = {
  dbName: ':memory:',
  entities: [Transaction],
  debug: false,
};

export default testConfig;