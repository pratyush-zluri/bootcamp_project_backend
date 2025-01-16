"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transactions_1 = require("./src/entities/transactions");
const testConfig = {
    dbName: ':memory:',
    entities: [transactions_1.Transaction],
    debug: false,
};
exports.default = testConfig;
