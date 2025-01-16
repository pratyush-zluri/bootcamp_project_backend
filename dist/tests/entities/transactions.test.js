"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mikro-orm/core");
const transactions_1 = require("../../src/entities/transactions");
const mikro_orm_config_1 = __importDefault(require("../../mikro-orm.config"));
describe('Transaction Entity', () => {
    let orm;
    let em;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        orm = yield core_1.MikroORM.init(mikro_orm_config_1.default);
        em = orm.em.fork();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield orm.close(true);
    }));
    it('should create a new transaction entity', () => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = new transactions_1.Transaction();
        transaction.date = new Date('2025-01-15');
        transaction.description = 'Test Transaction';
        transaction.originalAmount = 100.0;
        transaction.currency = 'USD';
        transaction.amount_in_inr = 7500.0;
        transaction.isDeleted = false;
        yield em.persistAndFlush(transaction);
        const savedTransaction = yield em.findOne(transactions_1.Transaction, { description: 'Test Transaction' });
        expect(savedTransaction).toBeDefined();
        expect(savedTransaction.date).toEqual(new Date('2025-01-15'));
        expect(savedTransaction.description).toBe('Test Transaction');
        expect(savedTransaction.originalAmount).toBe(100.0);
        expect(savedTransaction.currency).toBe('USD');
        expect(savedTransaction.amount_in_inr).toBe(7500.0);
        expect(savedTransaction.isDeleted).toBe(false);
    }));
    it('should update an existing transaction entity', () => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = yield em.findOne(transactions_1.Transaction, { description: 'Test Transaction' });
        if (transaction) {
            transaction.description = 'Updated Transaction';
            yield em.persistAndFlush(transaction);
            const updatedTransaction = yield em.findOne(transactions_1.Transaction, { description: 'Updated Transaction' });
            expect(updatedTransaction).toBeDefined();
            expect(updatedTransaction.description).toBe('Updated Transaction');
        }
    }));
    it('should soft delete a transaction entity', () => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = yield em.findOne(transactions_1.Transaction, { description: 'Updated Transaction' });
        if (transaction) {
            transaction.isDeleted = true;
            yield em.persistAndFlush(transaction);
            const deletedTransaction = yield em.findOne(transactions_1.Transaction, { description: 'Updated Transaction' });
            expect(deletedTransaction).toBeDefined();
            expect(deletedTransaction.isDeleted).toBe(true);
        }
    }));
    it('should remove a transaction entity', () => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = yield em.findOne(transactions_1.Transaction, { description: 'Updated Transaction' });
        if (transaction) {
            yield em.removeAndFlush(transaction);
            const removedTransaction = yield em.findOne(transactions_1.Transaction, { description: 'Updated Transaction' });
            expect(removedTransaction).toBeNull();
        }
    }));
});
