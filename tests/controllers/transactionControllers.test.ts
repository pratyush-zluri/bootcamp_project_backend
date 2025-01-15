import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { transactionController } from '../../src/controllers/transactionControllers';
import { Transaction } from '../../src/entities/transactions';
import currencyConversionRates from '../../src/globals/currencyConversionRates';

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
  let controller: transactionController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockEM: any;

  beforeEach(() => {
    controller = new transactionController();
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

    (MikroORM.init as jest.Mock).mockResolvedValue({
      em: mockEM
    });

    currencyConversionRates.USD = 1;
    currencyConversionRates.INR = 75;
    currencyConversionRates.EUR = 0.85;
  });

  describe('addTransaction', () => {
    it('should add a transaction successfully', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      await controller.addTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockEM.persistAndFlush).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid request body', async () => {
      mockRequest.body = { description: 'Test' }; // Missing required fields
      await controller.addTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid currency', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'INVALID'
      };
      await controller.addTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Invalid currency");
    });

    it('should handle database errors', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      mockEM.persistAndFlush.mockRejectedValue(new Error('DB Error'));
      await controller.addTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTransactions', () => {
    it('should return a list of transactions', async () => {
      const transactions = [
        { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', isDeleted: false },
        { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'INR', isDeleted: false }
      ];
      mockEM.find.mockResolvedValue(transactions);
      await controller.getTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.send).toHaveBeenCalledWith(transactions);
    });

    it('should return 404 if no transactions are found', async () => {
      mockEM.find.mockResolvedValue([]);
      await controller.getTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith("No transactions found");
    });

    it('should handle database errors', async () => {
      mockEM.find.mockRejectedValue(new Error('DB Error'));
      await controller.getTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSoftDeletedTransactions', () => {
    it('should return a list of soft-deleted transactions', async () => {
      const transactions = [
        { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', isDeleted: true },
        { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'INR', isDeleted: true }
      ];
      mockEM.find.mockResolvedValue(transactions);
      await controller.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.send).toHaveBeenCalledWith(transactions);
    });

    it('should return 404 if no soft-deleted transactions are found', async () => {
      mockEM.find.mockResolvedValue([]);
      await controller.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith("No transactions found");
    });

    it('should handle database errors', async () => {
      mockEM.find.mockRejectedValue(new Error('DB Error'));
      await controller.getSoftDeletedTransactions(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateTransaction', () => {
    beforeEach(() => {
      const mockTransaction = new Transaction();
      Object.assign(mockTransaction, {
        id: 1,
        description: 'Original description',
        originalAmount: 100,
        currency: 'USD',
        isDeleted: false
      });
      mockEM.findOne.mockResolvedValue(mockTransaction);
    });

    it('should update transaction successfully', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        description: 'Updated description',
        originalAmount: 200,
        currency: 'EUR'
      };
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockEM.flush).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(null);
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for soft-deleted transaction', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockTransaction.isDeleted = true;
      mockEM.findOne.mockResolvedValue(mockTransaction);
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Cannot update a soft-deleted transaction");
    });

    it('should return 400 for invalid request body', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { originalAmount: 'invalid' }; // Invalid amount type
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid currency or amount', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        description: 'Updated description',
        originalAmount: 200,
        currency: 'INVALID'
      };
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Invalid currency or amount");
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        description: 'Updated description',
        originalAmount: 200,
        currency: 'EUR'
      };
      mockEM.flush.mockRejectedValue(new Error('DB Error'));
      await controller.updateTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction successfully', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(new Transaction());
      await controller.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockEM.removeAndFlush).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await controller.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(null);
      await controller.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for soft-deleted transaction', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockTransaction.isDeleted = true;
      mockEM.findOne.mockResolvedValue(mockTransaction);
      await controller.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Cannot hard delete a soft-deleted transaction");
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(new Transaction());
      mockEM.removeAndFlush.mockRejectedValue(new Error('DB Error'));
      await controller.deleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('softDeleteTransaction', () => {
    it('should soft delete transaction successfully', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockEM.findOne.mockResolvedValue(mockTransaction);
      await controller.softDeleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockTransaction.isDeleted).toBe(true);
      expect(mockEM.flush).toHaveBeenCalled();
    });

    it('should return 404 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await controller.softDeleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(null);
      await controller.softDeleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockEM.findOne.mockResolvedValue(mockTransaction);
      mockEM.flush.mockRejectedValue(new Error('DB Error'));
      await controller.softDeleteTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('restoreTransaction', () => {
    it('should restore transaction successfully', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockTransaction.isDeleted = true;
      mockEM.findOne.mockResolvedValue(mockTransaction);
      await controller.restoreTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockTransaction.isDeleted).toBe(false);
      expect(mockEM.flush).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await controller.restoreTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 for non-existent or not soft-deleted transaction', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue(null);
      await controller.restoreTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      const mockTransaction = new Transaction();
      mockTransaction.isDeleted = true;
      mockEM.findOne.mockResolvedValue(mockTransaction);
      mockEM.flush.mockRejectedValue(new Error('DB Error'));
      await controller.restoreTransaction(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('downloadTransactionsCSV', () => {
    it('should download transactions as CSV', async () => {
      const transactions = [
        { id: 1, description: 'Transaction 1', originalAmount: 100, currency: 'USD', amount_in_inr: 7500 },
        { id: 2, description: 'Transaction 2', originalAmount: 200, currency: 'EUR', amount_in_inr: 17000 }
      ];
      mockEM.find.mockResolvedValue(transactions);
      await controller.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.attachment).toHaveBeenCalledWith('transactions.csv');
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockEM.find.mockRejectedValue(new Error('DB Error'));
      await controller.downloadTransactionsCSV(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});