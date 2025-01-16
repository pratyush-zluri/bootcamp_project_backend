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
const transactionControllers_1 = require("../../src/controllers/transactionControllers");
const transactions_1 = require("../../src/entities/transactions");
const currencyConversionRates_1 = __importDefault(require("../../src/globals/currencyConversionRates"));
// Mocks
jest.mock('@mikro-orm/core');
jest.mock('../../src/entities/transactions');
jest.mock('winston', () => ({
    format: {
        json: jest.fn()
    },
    transports: {
        Console: jest.fn()
    },
    createLogger: jest.fn(() => ({
        error: jest.fn(),
        info: jest.fn()
    }))
}));
global.fetch = jest.fn();
describe('transactionController', () => {
    let controller;
    let mockRequest;
    let mockResponse;
    let mockEM;
    beforeEach(() => {
        controller = new transactionControllers_1.transactionController();
        mockRequest = {
            body: {},
            params: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            header: jest.fn().mockReturnThis(),
            attachment: jest.fn().mockReturnThis()
        };
        mockEM = {
            find: jest.fn(),
            findOne: jest.fn(),
            persistAndFlush: jest.fn().mockResolvedValue(undefined),
            removeAndFlush: jest.fn().mockResolvedValue(undefined),
            flush: jest.fn().mockResolvedValue(undefined),
            fork: jest.fn().mockReturnThis()
        };
        core_1.MikroORM.init.mockResolvedValue({
            em: mockEM
        });
        currencyConversionRates_1.default.USD = 1;
        currencyConversionRates_1.default.INR = 75;
        currencyConversionRates_1.default.EUR = 0.85;
    });
    describe('addTransaction', () => {
        it('should add a transaction successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'USD'
            };
            yield controller.addTransaction(mockRequest, mockResponse);
            expect(mockEM.persistAndFlush).toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(201);
        }));
        it('should return 400 for invalid request body', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = { description: 'Test' }; // Missing required fields
            yield controller.addTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        }));
        it('should return 400 for invalid currency', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'INVALID'
            };
            yield controller.addTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Invalid currency");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'USD'
            };
            mockEM.persistAndFlush.mockRejectedValue(new Error('DB Error'));
            yield controller.addTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getTransactions', () => {
        it('should return a list of transactions', () => __awaiter(void 0, void 0, void 0, function* () {
            const transactions = [
                { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', isDeleted: false },
                { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'INR', isDeleted: false }
            ];
            mockEM.find.mockResolvedValue(transactions);
            yield controller.getTransactions(mockRequest, mockResponse);
            expect(mockResponse.send).toHaveBeenCalledWith(transactions);
        }));
        it('should return 404 if no transactions are found', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEM.find.mockResolvedValue([]);
            yield controller.getTransactions(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.send).toHaveBeenCalledWith("No transactions found");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEM.find.mockRejectedValue(new Error('DB Error'));
            yield controller.getTransactions(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('getSoftDeletedTransactions', () => {
        it('should return a list of soft-deleted transactions', () => __awaiter(void 0, void 0, void 0, function* () {
            const transactions = [
                { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', isDeleted: true },
                { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'INR', isDeleted: true }
            ];
            mockEM.find.mockResolvedValue(transactions);
            yield controller.getSoftDeletedTransactions(mockRequest, mockResponse);
            expect(mockResponse.send).toHaveBeenCalledWith(transactions);
        }));
        it('should return 404 if no soft-deleted transactions are found', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEM.find.mockResolvedValue([]);
            yield controller.getSoftDeletedTransactions(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.send).toHaveBeenCalledWith("No transactions found");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEM.find.mockRejectedValue(new Error('DB Error'));
            yield controller.getSoftDeletedTransactions(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('updateTransaction', () => {
        beforeEach(() => {
            const mockTransaction = new transactions_1.Transaction();
            Object.assign(mockTransaction, {
                id: 1,
                description: 'Original description',
                originalAmount: 100,
                currency: 'USD',
                isDeleted: false
            });
            mockEM.findOne.mockResolvedValue(mockTransaction);
        });
        it('should update transaction successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockRequest.body = {
                description: 'Updated description',
                originalAmount: 200,
                currency: 'EUR'
            };
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockEM.flush).toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        }));
        it('should return 404 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: 'invalid' };
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 404 for non-existent transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(null);
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 400 for soft-deleted transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockTransaction.isDeleted = true;
            mockEM.findOne.mockResolvedValue(mockTransaction);
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Cannot update a soft-deleted transaction");
        }));
        it('should return 400 for invalid request body', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockRequest.body = { originalAmount: 'invalid' }; // Invalid amount type
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        }));
        it('should return 400 for invalid currency or amount', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockRequest.body = {
                description: 'Updated description',
                originalAmount: 200,
                currency: 'INVALID'
            };
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Invalid currency or amount");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockRequest.body = {
                description: 'Updated description',
                originalAmount: 200,
                currency: 'EUR'
            };
            mockEM.flush.mockRejectedValue(new Error('DB Error'));
            yield controller.updateTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('deleteTransaction', () => {
        it('should delete transaction successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(new transactions_1.Transaction());
            yield controller.deleteTransaction(mockRequest, mockResponse);
            expect(mockEM.removeAndFlush).toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        }));
        it('should return 404 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: 'invalid' };
            yield controller.deleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 404 for non-existent transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(null);
            yield controller.deleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 400 for soft-deleted transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockTransaction.isDeleted = true;
            mockEM.findOne.mockResolvedValue(mockTransaction);
            yield controller.deleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Cannot hard delete a soft-deleted transaction");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(new transactions_1.Transaction());
            mockEM.removeAndFlush.mockRejectedValue(new Error('DB Error'));
            yield controller.deleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('softDeleteTransaction', () => {
        it('should soft delete transaction successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockEM.findOne.mockResolvedValue(mockTransaction);
            yield controller.softDeleteTransaction(mockRequest, mockResponse);
            expect(mockTransaction.isDeleted).toBe(true);
            expect(mockEM.flush).toHaveBeenCalled();
        }));
        it('should return 404 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: 'invalid' };
            yield controller.softDeleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 404 for non-existent transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(null);
            yield controller.softDeleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockEM.findOne.mockResolvedValue(mockTransaction);
            mockEM.flush.mockRejectedValue(new Error('DB Error'));
            yield controller.softDeleteTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('restoreTransaction', () => {
        it('should restore transaction successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockTransaction.isDeleted = true;
            mockEM.findOne.mockResolvedValue(mockTransaction);
            yield controller.restoreTransaction(mockRequest, mockResponse);
            expect(mockTransaction.isDeleted).toBe(false);
            expect(mockEM.flush).toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        }));
        it('should return 404 for invalid ID', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: 'invalid' };
            yield controller.restoreTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should return 404 for non-existent or not soft-deleted transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue(null);
            yield controller.restoreTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            const mockTransaction = new transactions_1.Transaction();
            mockTransaction.isDeleted = true;
            mockEM.findOne.mockResolvedValue(mockTransaction);
            mockEM.flush.mockRejectedValue(new Error('DB Error'));
            yield controller.restoreTransaction(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
    describe('downloadTransactionsCSV', () => {
        it('should download transactions as CSV', () => __awaiter(void 0, void 0, void 0, function* () {
            const transactions = [
                { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', amount_in_inr: 7500 },
                { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'EUR', amount_in_inr: 17000 }
            ];
            mockEM.find.mockResolvedValue(transactions);
            yield controller.downloadTransactionsCSV(mockRequest, mockResponse);
            expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockResponse.attachment).toHaveBeenCalledWith('transactions.csv');
            expect(mockResponse.send).toHaveBeenCalled();
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockEM.find.mockRejectedValue(new Error('DB Error'));
            yield controller.downloadTransactionsCSV(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
        }));
    });
});
