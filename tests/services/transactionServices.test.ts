import TransactionService from '../../src/services/transactionServices';
import { EntityManager } from '@mikro-orm/core';
import { Transaction } from '../../src/entities/transactions';
import initORM from '../../src/utils/init_ORM';
import currencyConversionRates from "../../src/globals/currencyConversionRates";

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
        it('should return correct conversion rate for valid currency', () => {
            const rate = TransactionService.getConversionRate('USD');
            expect(rate).toBe(75);
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
            });
        });

        it('should throw error for invalid date', async () => {
            const invalidData = { ...validTransactionData, date: 'invalid-date' };

            await expect(TransactionService.addTransaction(invalidData)).rejects.toThrow(
                'Invalid date format'
            );
        });
    });

    describe('getTransactions', () => {
        it('should return paginated transactions', async () => {
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
    });

    describe('getSoftDeletedTransactions', () => {
        it('should return soft-deleted transactions', async () => {
            const mockTransactions = [new Transaction(), new Transaction()];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.getSoftDeletedTransactions();

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: true },
                { orderBy: { date: 'DESC' } }
            );
            expect(result).toEqual(mockTransactions);
        });
    });

    describe('updateTransaction', () => {
        const mockTransaction = new Transaction();
        mockTransaction.id = 1;
        mockTransaction.currency = 'USD';
        mockTransaction.originalAmount = 100;
        mockTransaction.isDeleted = false;

        it('should successfully update a transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            const updateData = {
                description: 'Updated Description',
                originalAmount: 200,
                currency: 'EUR',
                date: '2025-01-21'
            };

            const result = await TransactionService.updateTransaction(1, updateData);

            expect(result.description).toBe(updateData.description);
            expect(result.originalAmount).toBe(updateData.originalAmount);
            expect(result.currency).toBe(updateData.currency);
            expect(result.amount_in_inr).toBe(updateData.originalAmount * 85);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.updateTransaction(1, { description: 'test' }))
                .rejects.toThrow('Transaction not found');
        });

        it('should throw error when updating soft-deleted transaction', async () => {
            const deletedTransaction = { ...mockTransaction, isDeleted: true };
            mockEntityManager.findOne.mockResolvedValue(deletedTransaction);

            await expect(TransactionService.updateTransaction(1, { description: 'test' }))
                .rejects.toThrow('Cannot update a soft-deleted transaction');
        });

        it('should throw error for invalid date', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            await expect(TransactionService.updateTransaction(1, { date: 'invalid-date' }))
                .rejects.toThrow('Invalid date format');
        });
    });

    describe('deleteTransaction', () => {
        it('should successfully delete a transaction', async () => {
            const mockTransaction = new Transaction();
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            await TransactionService.deleteTransaction(1);

            expect(mockEntityManager.removeAndFlush).toHaveBeenCalledWith(mockTransaction);
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.deleteTransaction(1))
                .rejects.toThrow('Transaction not found');
        });
    });

    describe('softDeleteTransaction', () => {
        const mockTransaction = new Transaction();
        mockTransaction.isDeleted = false;

        it('should successfully soft delete a transaction', async () => {
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
            const deletedTransaction = { ...mockTransaction, isDeleted: true };
            mockEntityManager.findOne.mockResolvedValue(deletedTransaction);

            await expect(TransactionService.softDeleteTransaction(1))
                .rejects.toThrow('Transaction already soft-deleted');
        });
    });

    describe('restoreTransaction', () => {
        const mockTransaction = new Transaction();
        mockTransaction.isDeleted = true;

        it('should successfully restore a transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction);

            const result = await TransactionService.restoreTransaction(1);

            expect(result.isDeleted).toBe(false);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found or not soft-deleted', async () => {
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
});