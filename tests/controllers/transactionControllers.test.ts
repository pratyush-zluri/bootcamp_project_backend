import { Request, Response } from 'express';
import * as TransactionController from '../../src/controllers/transactionControllers';
import TransactionService from '../../src/services/transactionServices';
import { parseAsync } from 'json2csv';
import logger from '../../src/utils/logger';

jest.mock('../../src/services/transactionServices');
jest.mock('json2csv');
jest.mock('../../src/utils/logger');

describe('Transaction Controller', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            attachment: jest.fn().mockReturnThis(),
        };
    });

    describe('addTransaction', () => {
        const mockTransactionData = {
            description: 'Test Transaction',
            originalAmount: 100,
            currency: 'USD',
            date: '2024-01-18'
        };

        it('should successfully add a transaction', async () => {
            mockRequest = { body: mockTransactionData };
            const mockCreatedTransaction = { id: 1, ...mockTransactionData };
            (TransactionService.addTransaction as jest.Mock).mockResolvedValue(mockCreatedTransaction);

            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedTransaction);
        });

        it('should handle missing description', async () => {
            mockRequest = { body: { originalAmount: 100, currency: 'USD', date: '2024-01-18' } };
            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Missing required fields' });
        });

        it('should handle missing originalAmount', async () => {
            mockRequest = { body: { description: 'Test', currency: 'USD', date: '2024-01-18' } };
            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Missing required fields' });
        });

        it('should handle missing currency', async () => {
            mockRequest = { body: { description: 'Test', originalAmount: 100, date: '2024-01-18' } };
            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Missing required fields' });
        });

        it('should handle missing date', async () => {
            mockRequest = { body: { description: 'Test', originalAmount: 100, currency: 'USD' } };
            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Missing required fields' });
        });

        it('should handle currency conversion error', async () => {
            mockRequest = { body: mockTransactionData };
            const error = new Error('Conversion rate for currency USD not found');
            (TransactionService.addTransaction as jest.Mock).mockRejectedValue(error);

            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: error.message });
        });

        it('should handle other errors', async () => {
            mockRequest = { body: mockTransactionData };
            const error = new Error('Database error');
            (TransactionService.addTransaction as jest.Mock).mockRejectedValue(error);

            await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error adding transaction:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while adding the transaction' });
        });
    });

    describe('getTransactions', () => {
        it('should get transactions with default pagination', async () => {
            mockRequest = { query: {} };
            const mockTransactions = [{ id: 1 }];
            const mockTotal = 1;
            (TransactionService.getTransactions as jest.Mock).mockResolvedValue([mockTransactions, mockTotal]);

            await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getTransactions).toHaveBeenCalledWith(1, 10);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 1,
                limit: 10,
                totalPages: 1
            });
        });

        it('should get transactions with custom pagination', async () => {
            mockRequest = { query: { page: '2', limit: '20' } };
            const mockTransactions = [{ id: 1 }];
            const mockTotal = 25;
            (TransactionService.getTransactions as jest.Mock).mockResolvedValue([mockTransactions, mockTotal]);

            await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getTransactions).toHaveBeenCalledWith(2, 20);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 2,
                limit: 20,
                totalPages: 2
            });
        });

        it('should handle invalid total', async () => {
            mockRequest = { query: {} };
            (TransactionService.getTransactions as jest.Mock).mockResolvedValue([[], undefined]);

            await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Invalid total count:', undefined);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while fetching transactions' });
        });

        it('should handle service error', async () => {
            mockRequest = { query: {} };
            const error = new Error('Database error');
            (TransactionService.getTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error fetching transactions:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while fetching transactions' });
        });
    });

    describe('updateTransaction', () => {
        const mockUpdateData = {
            description: 'Updated Transaction',
            originalAmount: 200,
            currency: 'EUR',
            date: '2024-01-18'
        };

        it('should successfully update transaction', async () => {
            mockRequest = { params: { id: '1' }, body: mockUpdateData };
            const updatedTransaction = { id: 1, ...mockUpdateData };
            (TransactionService.updateTransaction as jest.Mock).mockResolvedValue(updatedTransaction);

            await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Transaction updated successfully',
                transaction: updatedTransaction
            });
        });

        it('should handle transaction not found', async () => {
            mockRequest = { params: { id: '999' }, body: mockUpdateData };
            (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(new Error('Transaction not found'));

            await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction not found' });
        });

        it('should handle currency conversion error', async () => {
            mockRequest = { params: { id: '1' }, body: mockUpdateData };
            (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(new Error('Conversion rate for currency'));

            await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Conversion rate for currency' });
        });

        it('should handle invalid date format', async () => {
            mockRequest = { params: { id: 'hi' }, body: mockUpdateData };
            (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(new Error('Invalid date format'));

            await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid date format' });
        });

        it('should handle soft-deleted transaction update', async () => {
            mockRequest = { params: { id: '1' }, body: mockUpdateData };
            (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(new Error('Cannot update a soft-deleted transaction'));

            await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction is soft-deleted and cannot be updated' });
        });
    });

    describe('deleteTransaction', () => {
        it('should successfully delete transaction', async () => {
            mockRequest = { params: { id: '1' } };
            (TransactionService.deleteTransaction as jest.Mock).mockResolvedValue(undefined);

            await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction deleted successfully' });
        });

        it('should handle invalid id format', async () => {
            mockRequest = { params: { id: 'abc' } };

            await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid id format' });
        });

        it('should handle transaction not found', async () => {
            mockRequest = { params: { id: '999' } };
            (TransactionService.deleteTransaction as jest.Mock).mockRejectedValue(new Error('Transaction not found'));

            await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction not found' });
        });

        it('should handle other errors', async () => {
            mockRequest = { params: { id: '1' } };
            const error = new Error('Database error');
            (TransactionService.deleteTransaction as jest.Mock).mockRejectedValue(error);

            await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error deleting transaction:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while deleting the transaction' });
        });
    });

    describe('softDeleteTransaction', () => {
        it('should successfully soft delete transaction', async () => {
            mockRequest = { params: { id: '1' } };
            const deletedTransaction = { id: 1, isDeleted: true };
            (TransactionService.softDeleteTransaction as jest.Mock).mockResolvedValue(deletedTransaction);

            await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Transaction soft deleted',
                transaction: deletedTransaction
            });
        });

        it('should handle invalid id format', async () => {
            mockRequest = { params: { id: 'abc' } };

            await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid id format' });
        });

        it('should handle transaction not found', async () => {
            mockRequest = { params: { id: '999' } };
            (TransactionService.softDeleteTransaction as jest.Mock).mockRejectedValue(new Error('Transaction not found'));

            await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction not found' });
        });

        it('should handle already soft-deleted transaction', async () => {
            mockRequest = { params: { id: '1' } };
            (TransactionService.softDeleteTransaction as jest.Mock).mockRejectedValue(new Error('Transaction already soft-deleted'));

            await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction already soft-deleted' });
        });
    });

    describe('restoreTransaction', () => {
        it('should successfully restore transaction', async () => {
            mockRequest = { params: { id: '1' } };
            const restoredTransaction = { id: 1, isDeleted: false };
            (TransactionService.restoreTransaction as jest.Mock).mockResolvedValue(restoredTransaction);

            await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Transaction restored successfully',
                transaction: restoredTransaction
            });
        });

        it('should handle invalid id format', async () => {
            mockRequest = { params: { id: 'abc' } };

            await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid id format' });
        });

        it('should handle transaction not found or not soft-deleted', async () => {
            mockRequest = { params: { id: '999' } };
            (TransactionService.restoreTransaction as jest.Mock).mockRejectedValue(new Error('Transaction not found or not soft-deleted'));

            await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transaction not found or not soft-deleted' });
        });

        it('should handle other errors', async () => {
            mockRequest = { params: { id: '1' } };
            const error = new Error('Database error');
            (TransactionService.restoreTransaction as jest.Mock).mockRejectedValue(error);

            await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error restoring transaction:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith("An error occurred while restoring the transaction");
        });
    });

    describe('downloadTransactionsCSV', () => {
        it('should successfully download transactions CSV', async () => {
            mockRequest = {};
            const mockTransactions = [
                { id: 1, description: 'Test', originalAmount: 100, currency: 'USD', amount_in_inr: 7500 }
            ];
            const mockCSV = 'id,description,amount\n1,Test,7500';

            (TransactionService.getTransactionsCSV as jest.Mock).mockResolvedValue(mockTransactions);
            (parseAsync as jest.Mock).mockResolvedValue(mockCSV);

            await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockResponse.attachment).toHaveBeenCalledWith('transactions.csv');
            expect(mockResponse.send).toHaveBeenCalledWith(mockCSV);
        });

        it('should handle empty transactions list', async () => {
            mockRequest = {};
            (TransactionService.getTransactionsCSV as jest.Mock).mockResolvedValue([]);

            await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('No transactions available to download');
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'No transactions available to download' });
        });

        it('should handle CSV generation error', async () => {
            mockRequest = {};
            const error = new Error('CSV generation failed');
            (TransactionService.getTransactionsCSV as jest.Mock).mockResolvedValue([{ id: 1 }]);
            (parseAsync as jest.Mock).mockRejectedValue(error);

            await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error downloading transactions as CSV:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while downloading transactions' });
        });
    });

    describe('batchSoftDeleteTransactions', () => {
        it('should successfully batch soft delete transactions', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            const deletedTransactions = [
                { id: 1, isDeleted: true },
                { id: 2, isDeleted: true },
                { id: 3, isDeleted: true }
            ];
            (TransactionService.batchSoftDeleteTransactions as jest.Mock).mockResolvedValue(deletedTransactions);

            await TransactionController.batchSoftDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Transactions soft deleted',
                transactions: deletedTransactions
            });
        });

        it('should handle invalid IDs format', async () => {
            mockRequest = { body: { ids: ['1', 'abc', '3'] } };

            await TransactionController.batchSoftDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid IDs format. Please provide an array of numbers.' });
        });

        it('should handle batch soft delete error', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            const error = new Error('Batch deletion failed');
            (TransactionService.batchSoftDeleteTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.batchSoftDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error batch soft-deleting transactions:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while batch deleting transactions' });
        });
    });

    describe('searchAllTransactions', () => {
        it('should successfully search transactions with default pagination', async () => {
            mockRequest = { query: { query: 'test' } };
            const mockTransactions = [{ id: 1, description: 'test transaction' }];
            const mockTotal = 1;
            (TransactionService.searchAllTransactions as jest.Mock).mockResolvedValue({ transactions: mockTransactions, total: mockTotal });

            await TransactionController.searchAllTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.searchAllTransactions).toHaveBeenCalledWith('test', 1, 10);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 1,
                limit: 10,
            });
        });

        it('should successfully search transactions with custom pagination', async () => {
            mockRequest = { query: { query: 'test', page: '2', limit: '5' } };
            const mockTransactions = [{ id: 1, description: 'test transaction' }];
            const mockTotal = 6;
            (TransactionService.searchAllTransactions as jest.Mock).mockResolvedValue({ transactions: mockTransactions, total: mockTotal });

            await TransactionController.searchAllTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.searchAllTransactions).toHaveBeenCalledWith('test', 2, 5);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 2,
                limit: 5,
            });
        });

        it('should handle search error', async () => {
            mockRequest = { query: { query: 'test' } };
            const error = new Error('Search failed');
            (TransactionService.searchAllTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.searchAllTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error searching transactions:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while searching transactions' });
        });
    });


    describe('batchHardDeleteTransactions', () => {
        it('should successfully hard delete multiple transactions', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            (TransactionService.batchHardDeleteTransactions as jest.Mock).mockResolvedValue(undefined);

            await TransactionController.batchHardDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transactions permanently deleted' });
        });

        it('should handle invalid IDs format', async () => {
            mockRequest = { body: { ids: ['1', 'abc', '3'] } };

            await TransactionController.batchHardDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid IDs format. Please provide an array of numbers.' });
        });

        it('should handle batch hard delete error', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            const error = new Error('Batch deletion failed');
            (TransactionService.batchHardDeleteTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.batchHardDeleteTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error batch hard deleting transactions:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while batch deleting transactions' });
        });
    });

    describe('batchRestoreTransactions', () => {
        it('should successfully restore multiple transactions', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            (TransactionService.batchRestoreTransactions as jest.Mock).mockResolvedValue(undefined);

            await TransactionController.batchRestoreTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Transactions restored' });
        });

        it('should handle invalid IDs format', async () => {
            mockRequest = { body: { ids: ['1', 'abc', '3'] } };

            await TransactionController.batchRestoreTransactions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid IDs format. Please provide an array of numbers.' });
        });

        it('should handle batch restore error', async () => {
            mockRequest = { body: { ids: ['1', '2', '3'] } };
            const error = new Error('Batch restore failed');
            (TransactionService.batchRestoreTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.batchRestoreTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith('Error batch restoring transactions:', error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while batch restoring transactions' });
        });
    });
    describe('getSoftDeletedTransactions', () => {
        it('should get soft-deleted transactions with default pagination', async () => {
            mockRequest = { query: {} };
            const mockTransactions = [{ id: 1, description: 'Transaction 1' }];
            const mockTotal = 1;
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue({
                transactions: mockTransactions,
                total: mockTotal
            });

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getSoftDeletedTransactions).toHaveBeenCalledWith(1, 10);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
        });

        it('should get soft-deleted transactions with custom pagination', async () => {
            mockRequest = { query: { page: '2', limit: '5' } };
            const mockTransactions = [{ id: 2, description: 'Transaction 2' }];
            const mockTotal = 6;
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue({
                transactions: mockTransactions,
                total: mockTotal
            });

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getSoftDeletedTransactions).toHaveBeenCalledWith(2, 5);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 2,
                limit: 5,
                totalPages: 2,
            });
        });

        it('should handle service error', async () => {
            mockRequest = { query: {} };
            const error = new Error('Service error');
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith("Error fetching soft-deleted transactions:", error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while fetching soft-deleted transactions' });
        });
    }); describe('getSoftDeletedTransactions', () => {
        it('should get soft-deleted transactions with default pagination', async () => {
            mockRequest = { query: {} };
            const mockTransactions = [{ id: 1, description: 'Transaction 1' }];
            const mockTotal = 1;
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue({
                transactions: mockTransactions,
                total: mockTotal
            });

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getSoftDeletedTransactions).toHaveBeenCalledWith(1, 10);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
        });

        it('should get soft-deleted transactions with custom pagination', async () => {
            mockRequest = { query: { page: '2', limit: '5' } };
            const mockTransactions = [{ id: 2, description: 'Transaction 2' }];
            const mockTotal = 6;
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue({
                transactions: mockTransactions,
                total: mockTotal
            });

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(TransactionService.getSoftDeletedTransactions).toHaveBeenCalledWith(2, 5);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                transactions: mockTransactions,
                total: mockTotal,
                page: 2,
                limit: 5,
                totalPages: 2,
            });
        });

        it('should handle service error', async () => {
            mockRequest = { query: {} };
            const error = new Error('Service error');
            (TransactionService.getSoftDeletedTransactions as jest.Mock).mockRejectedValue(error);

            await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

            expect(logger.error).toHaveBeenCalledWith("Error fetching soft-deleted transactions:", error);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred while fetching soft-deleted transactions' });
        });
    });
});