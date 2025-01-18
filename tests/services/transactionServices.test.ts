import { EntityManager } from '@mikro-orm/core';
import TransactionService from '../../src/services/transactionServices';
import { Transaction } from '../../src/entities/transactions';
import initORM from '../../src/utils/init_ORM';
import currencyConversionRates from '../../src/globals/currencyConversionRates';

// Mock dependencies
jest.mock('../../src/utils/init_ORM');
jest.mock('../../src/entities/transactions');

describe('TransactionService', () => {
    let mockEntityManager: jest.Mocked<EntityManager>;
    let mockTransaction: Partial<Transaction>;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock EntityManager
        mockEntityManager = {
            find: jest.fn(),
            findOne: jest.fn(),
            persistAndFlush: jest.fn(),
            removeAndFlush: jest.fn(),
            flush: jest.fn(),
        } as unknown as jest.Mocked<EntityManager>;

        // Setup mock Transaction
        mockTransaction = {
            id: 1,
            date: new Date('2025-01-18'),
            description: 'Test Transaction',
            currency: 'USD',
            originalAmount: 100,
            amount_in_inr: 8250,
            isDeleted: false,
        };

        // Mock initORM to return our mock EntityManager
        (initORM as jest.Mock).mockResolvedValue(mockEntityManager);
    });

    describe('getConversionRate', () => {
        it('should return correct conversion rate for valid currency', () => {
            const rate = TransactionService.getConversionRate('USD');
            expect(rate).toBe(currencyConversionRates.USD);
        });

        it('should throw error for invalid currency', () => {
            expect(() => TransactionService.getConversionRate('INVALID')).toThrow(
                'Conversion rate for currency INVALID not found'
            );
        });
    });

    describe('addTransaction', () => {
        const mockTransactionData = {
            description: 'Test Transaction',
            originalAmount: 100,
            currency: 'USD',
            date: '2025-01-18',
        };

        it('should successfully add a transaction', async () => {
            mockEntityManager.persistAndFlush.mockResolvedValue(undefined);
            const result = await TransactionService.addTransaction(mockTransactionData);

            expect(result).toBeInstanceOf(Transaction);
            expect(result.description).toBe(mockTransactionData.description);
            expect(result.originalAmount).toBe(mockTransactionData.originalAmount);
            expect(result.currency).toBe(mockTransactionData.currency);
            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
        });

        it('should throw error for invalid date', async () => {
            const invalidData = { ...mockTransactionData, date: 'invalid-date' };

            await expect(TransactionService.addTransaction(invalidData))
                .rejects
                .toThrow('Invalid date format');
        });

        it('should throw error for invalid currency', async () => {
            const invalidData = { ...mockTransactionData, currency: 'INVALID' };

            await expect(TransactionService.addTransaction(invalidData))
                .rejects
                .toThrow('Conversion rate for currency INVALID not found');
        });
    });

    describe('getTransactions', () => {
        it('should fetch transactions with pagination', async () => {
            const mockTransactions = [mockTransaction];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.getTransactions(1, 10);

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: false },
                {
                    orderBy: { date: 'DESC' },
                    offset: 0,
                    limit: 10,
                }
            );
            expect(result).toEqual(mockTransactions);
        });
    });

    describe('updateTransaction', () => {
        const mockUpdateData = {
            description: 'Updated Transaction',
            originalAmount: 200,
            currency: 'EUR',
            date: '2025-01-18',
        };

        it('should successfully update a transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction as Transaction);
            mockEntityManager.flush.mockResolvedValue(undefined);

            const result = await TransactionService.updateTransaction(1, mockUpdateData);

            expect(result.description).toBe(mockUpdateData.description);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.updateTransaction(999, mockUpdateData))
                .rejects
                .toThrow('Transaction not found');
        });

        it('should throw error when updating soft-deleted transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue({ ...mockTransaction, isDeleted: true } as Transaction);

            await expect(TransactionService.updateTransaction(1, mockUpdateData))
                .rejects
                .toThrow('Cannot update a soft-deleted transaction');
        });

        it('should throw error for invalid date', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction as Transaction);

            await expect(TransactionService.updateTransaction(1, { date: 'invalid-date' }))
                .rejects
                .toThrow('Invalid date format');
        });
    });

    describe('softDeleteTransaction', () => {
        it('should successfully soft delete a transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue(mockTransaction as Transaction);
            mockEntityManager.flush.mockResolvedValue(undefined);

            const result = await TransactionService.softDeleteTransaction(1);

            expect(result.isDeleted).toBe(true);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction already soft-deleted', async () => {
            mockEntityManager.findOne.mockResolvedValue({ ...mockTransaction, isDeleted: true } as Transaction);

            await expect(TransactionService.softDeleteTransaction(1))
                .rejects
                .toThrow('Transaction already soft-deleted');
        });
    });

    describe('restoreTransaction', () => {
        it('should successfully restore a soft-deleted transaction', async () => {
            mockEntityManager.findOne.mockResolvedValue({ ...mockTransaction, isDeleted: true } as Transaction);
            mockEntityManager.flush.mockResolvedValue(undefined);

            const result = await TransactionService.restoreTransaction(1);

            expect(result.isDeleted).toBe(false);
            expect(mockEntityManager.flush).toHaveBeenCalled();
        });

        it('should throw error when transaction not found or not soft-deleted', async () => {
            mockEntityManager.findOne.mockResolvedValue(null);

            await expect(TransactionService.restoreTransaction(1))
                .rejects
                .toThrow('Transaction not found or not soft-deleted');
        });
    });

    describe('getTransactionsCSV', () => {
        it('should fetch all non-deleted transactions', async () => {
            const mockTransactions = [mockTransaction];
            mockEntityManager.find.mockResolvedValue(mockTransactions);

            const result = await TransactionService.getTransactionsCSV();

            expect(mockEntityManager.find).toHaveBeenCalledWith(
                Transaction,
                { isDeleted: false }
            );
            expect(result).toEqual(mockTransactions);
        });
    });
});