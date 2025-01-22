import TransactionService from '../../src/services/transactionServices';
import { EntityManager } from '@mikro-orm/core';
import { Transaction } from '../../src/entities/transactions';
import initORM from '../../src/utils/init_ORM';
import currencyConversionRates from "../../src/globals/currencyConversionRates";
import { any } from 'joi';

// Mock dependencies
jest.mock('../../src/utils/init_ORM');
jest.mock('../../src/globals/currencyConversionRates', () => ({
    USD: 75,
    EUR: 85
}));

describe('TransactionService', () => {
    let mockEntityManager: jest.Mocked<EntityManager>;

    beforeEach(() => {
        mockEntityManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            persistAndFlush: jest.fn(),
            removeAndFlush: jest.fn(),
            flush: jest.fn(),
        } as any;

        (initORM as jest.Mock).mockResolvedValue(mockEntityManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getConversionRate', () => {
        it('should return correct conversion rate for USD', () => {
            expect(TransactionService.getConversionRate('USD')).toBe(75);
        });

        it('should return correct conversion rate for EUR', () => {
            expect(TransactionService.getConversionRate('EUR')).toBe(85);
        });

        it('should throw error for invalid currency', () => {
            expect(() => TransactionService.getConversionRate('INVALID')).toThrow(
                'Conversion rate for currency INVALID not found'
            );
        });
    });

    describe('addTransaction', () => {
        const validTransactionData = {
            description: 'Test Transaction',
            originalAmount: 100,
            currency: 'USD',
            date: '2025-01-21'
        };

        it('should successfully add a valid transaction', async () => {
            const result = await TransactionService.addTransaction(validTransactionData);
            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
            expect(result).toMatchObject({
                description: validTransactionData.description,
                originalAmount: validTransactionData.originalAmount,
                currency: validTransactionData.currency,
                amount_in_inr: validTransactionData.originalAmount * 75,
                date: expect.any(Date)
            });
        });

        it('should throw error for invalid date', async () => {
            const invalidData = { ...validTransactionData, date: 'invalid-date' };
            await expect(TransactionService.addTransaction(invalidData)).rejects.toThrow(
                'Invalid date format'
            );
        });

        it('should throw error for invalid currency', async () => {
            const invalidData = { ...validTransactionData, currency: 'INVALID' };
            await expect(TransactionService.addTransaction(invalidData)).rejects.toThrow(
                'Conversion rate for currency INVALID not found'
            );
        });
    });

    describe('getTransactions', () => {
        it('should return paginated transactions for first page', async () => {
            const mockTransactions = [new Transaction(), new Transaction()];
            const mockTotal = 2;
            mockEntityManager.findAndCount.mockResolvedValue([mockTransactions, mockTotal]);

            const [transactions, total] = await TransactionService.getTransactions(1, 10);

            expect(mockEntityManager.findAndCount).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: false },
                {
                    orderBy: { date: 'DESC' },
                    offset: 0,
                    limit: 10,
                }
            );
            expect(transactions).toEqual(mockTransactions);
            expect(total).toBe(mockTotal);
        });

        it('should return paginated transactions for second page', async () => {
            const mockTransactions = [new Transaction()];
            const mockTotal = 3;
            mockEntityManager.findAndCount.mockResolvedValue([mockTransactions, mockTotal]);

            const [transactions, total] = await TransactionService.getTransactions(2, 2);

            expect(mockEntityManager.findAndCount).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: false },
                {
                    orderBy: { date: 'DESC' },
                    offset: 2,
                    limit: 2,
                }
            );
            expect(transactions).toEqual(mockTransactions);
            expect(total).toBe(mockTotal);
        });

        it('should handle empty results', async () => {
            mockEntityManager.findAndCount.mockResolvedValue([[], 0]);

            const [transactions, total] = await TransactionService.getTransactions(1, 10);

            expect(transactions).toEqual([]);
            expect(total).toBe(0);
        });
    });

    describe('getSoftDeletedTransactions', () => {
        it('should return paginated soft-deleted transactions', async () => {
            const mockTransactions = [new Transaction(), new Transaction()];
            const mockTotal = 2;
            mockEntityManager.findAndCount.mockResolvedValue([mockTransactions, mockTotal]);

            const result = await TransactionService.getSoftDeletedTransactions(1, 10);

            expect(mockEntityManager.findAndCount).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: true },
                {
                    orderBy: { date: 'DESC' },
                    offset: 0,
                    limit: 10,
                }
            );
            expect(result).toEqual({
                transactions: mockTransactions,
                total: mockTotal
            });
        });

        it('should handle empty results', async () => {
            mockEntityManager.findAndCount.mockResolvedValue([[], 0]);

            const result = await TransactionService.getSoftDeletedTransactions(1, 10);

            expect(result).toEqual({
                transactions: [],
                total: 0
            });
        });
    });

    describe('updateTransaction', () => {
        const mockTransaction = new Transaction();
        mockTransaction.id = 1;
        mockTransaction.currency = 'USD';
        mockTransaction.originalAmount = 100;
        mockTransaction.isDeleted = false;

        beforeEach(() => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);
        });

        it('should update all fields when all data provided', async () => {
            const updateData = {
                description: 'Updated Description',
                originalAmount: 200,
                currency: 'EUR',
                date: '2025-01-21'
            };

            const result = await TransactionService.updateTransaction(1, updateData);

            expect(result).toMatchObject({
                description: updateData.description,
                originalAmount: updateData.originalAmount,
                currency: updateData.currency,
                amount_in_inr: updateData.originalAmount * 85,
                date: expect.any(Date)
            });
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.updateTransaction(1, { description: 'test' }))
                .rejects.toThrow('Transaction not found');
        });

        it('should throw error when updating soft-deleted transaction', async () => {
            const deletedTransaction = new Transaction();
            deletedTransaction.isDeleted = true;
            mockEntityManager.findOne.mockResolvedValue(deletedTransaction);

            await expect(TransactionService.updateTransaction(1, { description: 'test' }))
                .rejects.toThrow('Cannot update a soft-deleted transaction');
        });

        it('should throw error for invalid date', async () => {
            await expect(TransactionService.updateTransaction(1, { date: 'invalid-date' }))
                .rejects.toThrow('Invalid date format');
        });

        it('should throw error for invalid currency', async () => {
            await expect(TransactionService.updateTransaction(1, { currency: 'INVALID' }))
                .rejects.toThrow('Conversion rate for currency INVALID not found');
        });
    });

    describe('deleteTransaction', () => {
        it('should successfully delete a transaction', async () => {
            const mockTransaction = new Transaction();
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            await TransactionService.deleteTransaction(1);

            expect(mockEntityManager.findOne).toHaveBeenCalledWith(Transaction, 1);
            expect(mockEntityManager.removeAndFlush).toHaveBeenCalledWith(mockTransaction);
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.deleteTransaction(1))
                .rejects.toThrow('Transaction not found');
        });
    });

    describe('softDeleteTransaction', () => {
        it('should successfully soft delete a transaction', async () => {
            const mockTransaction = new Transaction();
            mockTransaction.isDeleted = false;
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            const result = await TransactionService.softDeleteTransaction(1);

            expect(result.isDeleted).toBe(true);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.softDeleteTransaction(1))
                .rejects.toThrow('Transaction not found');
        });

        it('should throw error when transaction already soft-deleted', async () => {
            const mockTransaction = new Transaction();
            mockTransaction.isDeleted = true;
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            await expect(TransactionService.softDeleteTransaction(1))
                .rejects.toThrow('Transaction already soft-deleted');
        });
    });

    describe('restoreTransaction', () => {
        it('should successfully restore a transaction', async () => {
            const mockTransaction = new Transaction();
            mockTransaction.isDeleted = true;
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            const result = await TransactionService.restoreTransaction(1);

            expect(result.isDeleted).toBe(false);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.restoreTransaction(1))
                .rejects.toThrow('Transaction not found or not soft-deleted');
        });
    });

    describe('getTransactionsCSV', () => {
        it('should return all non-deleted transactions', async () => {
            const mockTransactions = [new Transaction(), new Transaction()];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.getTransactionsCSV();

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: false }
            );
            expect(result).toEqual(mockTransactions);
        });

        it('should handle empty results', async () => {
            mockEntityManager.find.mockResolvedValue([]);

            const result = await TransactionService.getTransactionsCSV();

            expect(result).toEqual([]);
        });
    });

    describe('batchSoftDeleteTransactions', () => {
        it('should successfully soft delete multiple transactions', async () => {
            const mockTransactions = [
                { ...new Transaction(), isDeleted: false },
                { ...new Transaction(), isDeleted: false }
            ];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.batchSoftDeleteTransactions([1, 2]);

            expect(result).toEqual(mockTransactions);
            expect(result.every(t => t.isDeleted)).toBe(true);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when no transactions found', async () => {
            mockEntityManager.find.mockResolvedValue([]);

            await expect(TransactionService.batchSoftDeleteTransactions([1, 2]))
                .rejects.toThrow('No transactions found to delete');
        });
    });

    describe('searchAllTransactions', () => {
        it('should return matching transactions with pagination', async () => {
            const mockTransactions = [
                { description: 'Test Transaction', currency: 'USD' },
                { description: 'Another Test', currency: 'EUR' }
            ];
            const mockTotal = 2;
            mockEntityManager.findAndCount.mockResolvedValue([mockTransactions, mockTotal]);

            const result = await TransactionService.searchAllTransactions('Test', 1, 10);

            expect(mockEntityManager.findAndCount).toHaveBeenCalledWith(
                Transaction,
                {
                    $or: [
                        { description: expect.any(RegExp) },
                        { currency: expect.any(RegExp) }
                    ],
                    isDeleted: false
                },
                {
                    orderBy: { date: 'DESC' },
                    offset: 0,
                    limit: 10
                }
            );
            expect(result).toEqual({ transactions: mockTransactions, total: mockTotal });
        });

        it('should handle empty results with pagination', async () => {
            mockEntityManager.findAndCount.mockResolvedValue([[], 0]);

            const result = await TransactionService.searchAllTransactions('NonExistent', 1, 10);

            expect(result).toEqual({ transactions: [], total: 0 });
        });

        it('should perform case-insensitive search with pagination', async () => {
            const mockTransactions = [{ description: 'TEST TRANSACTION', currency: 'USD' }];
            const mockTotal = 1;
            mockEntityManager.findAndCount.mockResolvedValue([mockTransactions, mockTotal]);

            const result = await TransactionService.searchAllTransactions('test', 1, 10);

            expect(result).toEqual({ transactions: mockTransactions, total: mockTotal });
        });
    });

    describe('batchHardDeleteTransactions', () => {
        it('should successfully hard delete multiple transactions', async () => {
            const mockTransactions = [
                new Transaction(),
                new Transaction()
            ];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.batchHardDeleteTransactions([1, 2]);

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { id: { $in: [1, 2] }, isDeleted: true }
            );
            expect(mockEntityManager.removeAndFlush).toHaveBeenCalledWith(mockTransactions);
            expect(result).toEqual(mockTransactions);
        });

        it('should throw error when no transactions found', async () => {
            mockEntityManager.find.mockResolvedValue([]);

            await expect(TransactionService.batchHardDeleteTransactions([1, 2]))
                .rejects.toThrow('No transactions found to delete');
        });

        it('should handle single transaction deletion', async () => {
            const mockTransaction = new Transaction();
            mockEntityManager.find.mockResolvedValue([mockTransaction]);

            const result = await TransactionService.batchHardDeleteTransactions([1]);

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { id: { $in: [1] }, isDeleted: true }
            );
            expect(mockEntityManager.removeAndFlush).toHaveBeenCalledWith([mockTransaction]);
            expect(result).toEqual([mockTransaction]);
        });
    });

    describe('batchRestoreTransactions', () => {
        it('should successfully restore multiple transactions', async () => {
            const mockTransactions = [
                { ...new Transaction(), isDeleted: true },
                { ...new Transaction(), isDeleted: true }
            ];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.batchRestoreTransactions([1, 2]);

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { id: { $in: [1, 2] }, isDeleted: true }
            );
            expect(result.every(t => !t.isDeleted)).toBe(true);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when no transactions found', async () => {
            mockEntityManager.find.mockResolvedValue([]);

            await expect(TransactionService.batchRestoreTransactions([1, 2]))
                .rejects.toThrow('No transactions found to restore');
        });

        it('should handle single transaction restoration', async () => {
            const mockTransaction = { ...new Transaction(), isDeleted: true };
            mockEntityManager.find.mockResolvedValue([mockTransaction]);

            const result = await TransactionService.batchRestoreTransactions([1]);

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { id: { $in: [1] }, isDeleted: true }
            );
            expect(result[0].isDeleted).toBe(false);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should update isDeleted flag for all transactions', async () => {
            const mockTransactions = [
                { ...new Transaction(), isDeleted: true, id: 1 },
                { ...new Transaction(), isDeleted: true, id: 2 },
                { ...new Transaction(), isDeleted: true, id: 3 }
            ];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.batchRestoreTransactions([1, 2, 3]);

            expect(result.length).toBe(3);
            expect(result.every(t => !t.isDeleted)).toBe(true);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });
    });
});