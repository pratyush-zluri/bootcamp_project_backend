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
      expect(TransactionService.addTransaction).toHaveBeenCalledWith(mockTransactionData);
    });

    it('should handle errors when adding transaction', async () => {
      mockRequest = { body: mockTransactionData };
      const error = new Error('Database error');
      (TransactionService.addTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error adding transaction:', error);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith('An error occurred while adding the transaction');
    });

    it('should handle missing required fields', async () => {
      mockRequest = { body: { description: 'Test' } };
      await TransactionController.addTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith('Missing required fields');
    });
  });

  describe('getTransactions', () => {
    it('should get transactions with default pagination', async () => {
      mockRequest = { query: {} };
      const mockTransactions = [{ id: 1, description: 'Test' }];
      (TransactionService.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(TransactionService.getTransactions).toHaveBeenCalledWith(1, 10);
      expect(mockResponse.send).toHaveBeenCalledWith(mockTransactions);
    });

    it('should get transactions with custom pagination', async () => {
      mockRequest = { query: { page: '2', limit: '20' } };
      const mockTransactions = [{ id: 1, description: 'Test' }];
      (TransactionService.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(TransactionService.getTransactions).toHaveBeenCalledWith(2, 20);
    });

    it('should handle no transactions found', async () => {
      mockRequest = { query: {} };
      (TransactionService.getTransactions as jest.Mock).mockResolvedValue([]);

      await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith('No transactions found');
    });

    it('should handle errors when fetching transactions', async () => {
      mockRequest = { query: {} };
      const error = new Error('Database error');
      (TransactionService.getTransactions as jest.Mock).mockRejectedValue(error);

      await TransactionController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error fetching transactions:', error);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith('An error occurred while fetching transactions');
    });
  });

  describe('getSoftDeletedTransactions', () => {
    it('should get soft-deleted transactions', async () => {
      mockRequest = {};
      const mockTransactions = [{ id: 1, description: 'Test', isDeleted: true }];
      (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.send).toHaveBeenCalledWith(mockTransactions);
    });

    it('should handle no soft-deleted transactions found', async () => {
      mockRequest = {};
      (TransactionService.getSoftDeletedTransactions as jest.Mock).mockResolvedValue([]);

      await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith('No transactions found');
    });

    it('should handle errors when fetching soft-deleted transactions', async () => {
      mockRequest = {};
      const error = new Error('Database error');
      (TransactionService.getSoftDeletedTransactions as jest.Mock).mockRejectedValue(error);

      await TransactionController.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error fetching transactions:', error);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateTransaction', () => {
    const mockUpdateData = {
      description: 'Updated Transaction',
      originalAmount: 200,
      currency: 'EUR',
      date: '2024-01-18'
    };

    it('should successfully update a transaction', async () => {
      mockRequest = {
        params: { id: '1' },
        body: mockUpdateData
      };
      const mockUpdatedTransaction = { id: 1, ...mockUpdateData };
      (TransactionService.updateTransaction as jest.Mock).mockResolvedValue(mockUpdatedTransaction);

      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Transaction updated successfully',
        transaction: mockUpdatedTransaction
      });
    });

    it('should handle transaction not found error', async () => {
      mockRequest = {
        params: { id: '999' },
        body: mockUpdateData
      };
      const error = new Error('Transaction not found');
      (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Transaction not found' });
    });

    it('should handle invalid currency conversion error', async () => {
      mockRequest = {
        params: { id: '1' },
        body: mockUpdateData
      };
      const error = new Error('Conversion rate for currency EUR not found');
      (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: error.message });
    });

    it('should handle invalid date format error', async () => {
      mockRequest = {
        params: { id: '1' },
        body: mockUpdateData
      };
      const error = new Error('Invalid date format');
      (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
    });

    it('should handle soft-deleted transaction update error', async () => {
      mockRequest = {
        params: { id: '1' },
        body: mockUpdateData
      };
      const error = new Error('Cannot update a soft-deleted transaction');
      (TransactionService.updateTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Transaction is soft-deleted and cannot be updated'
      });
    });

    it('should handle missing required fields', async () => {
      mockRequest = {
        params: { id: '1' },
        body: { description: 'Test' } // missing originalAmount, currency, date
      };
      await TransactionController.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith('Missing required fields');
    });
  });

  describe('deleteTransaction', () => {
    it('should successfully delete a transaction', async () => {
      mockRequest = { params: { id: '1' } };
      (TransactionService.deleteTransaction as jest.Mock).mockResolvedValue(undefined);

      await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith('Transaction deleted successfully');
    });

    it('should handle transaction not found error', async () => {
      mockRequest = { params: { id: '999' } };
      const error = new Error('Transaction not found');
      (TransactionService.deleteTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Transaction not found' });
    });

    it('should handle invalid id values', async () => {
      mockRequest = { params: { id: 'abc' } };
      await TransactionController.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith('Invalid id format');
    });
  });

  describe('softDeleteTransaction', () => {
    it('should successfully soft delete a transaction', async () => {
      mockRequest = { params: { id: '1' } };
      const mockDeletedTransaction = { id: 1, deleted: true };
      (TransactionService.softDeleteTransaction as jest.Mock).mockResolvedValue(mockDeletedTransaction);

      await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Transaction soft deleted',
        transaction: mockDeletedTransaction
      });
    });

    it('should handle already soft-deleted transaction', async () => {
      mockRequest = { params: { id: '1' } };
      const error = new Error('Transaction already soft-deleted');
      (TransactionService.softDeleteTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Transaction already soft-deleted' });
    });

    it('should handle invalid id values', async () => {
      mockRequest = { params: { id: 'abc' } };
      await TransactionController.softDeleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith('Invalid id format');
    });
  });

  describe('restoreTransaction', () => {
    it('should successfully restore a transaction', async () => {
      mockRequest = { params: { id: '1' } };
      const mockRestoredTransaction = { id: 1, deleted: false };
      (TransactionService.restoreTransaction as jest.Mock).mockResolvedValue(mockRestoredTransaction);

      await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Transaction restored successfully',
        transaction: mockRestoredTransaction
      });
    });

    it('should handle transaction not found or not soft-deleted error', async () => {
      mockRequest = { params: { id: '1' } };
      const error = new Error('Transaction not found or not soft-deleted');
      (TransactionService.restoreTransaction as jest.Mock).mockRejectedValue(error);

      await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Transaction not found or not soft-deleted'
      });
    });

    it('should handle invalid id values', async () => {
      mockRequest = { params: { id: 'abc' } };
      await TransactionController.restoreTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith('Invalid id format');
    });
  });

  describe('downloadTransactionsCSV', () => {
    it('should successfully download transactions as CSV', async () => {
      mockRequest = {};
      const mockTransactions = [{ id: 1, description: 'Test', amount_in_inr: 1000 }];
      const mockCSV = 'id,description,amount_in_inr\n1,Test,1000';

      (TransactionService.getTransactionsCSV as jest.Mock).mockResolvedValue(mockTransactions);
      (parseAsync as jest.Mock).mockResolvedValue(mockCSV);

      await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.attachment).toHaveBeenCalledWith('transactions.csv');
      expect(mockResponse.send).toHaveBeenCalledWith(mockCSV);
    });

    it('should handle errors when downloading CSV', async () => {
      mockRequest = {};
      const error = new Error('CSV generation failed');
      (TransactionService.getTransactionsCSV as jest.Mock).mockRejectedValue(error);

      await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error downloading transactions as CSV:', error);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith('An error occurred while downloading transactions');
    });

    it('should handle empty transactions list', async () => {
      mockRequest = {};
      (TransactionService.getTransactionsCSV as jest.Mock).mockResolvedValue([]);

      await TransactionController.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('No transactions available to download');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith('No transactions available to download');
    });
  });
});