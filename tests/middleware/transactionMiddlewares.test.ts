import { Request, Response, NextFunction } from 'express';
import {
  idValidator,
  pageLimitValidator,
  newEntryValidator,
  validateUpdate,
  checkSoftDeleted
} from '../../src/middlewares/transactionMiddlewares';
import { Transaction } from '../../src/entities/transactions';
import logger from '../../src/utils/logger';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn()
}));

// Mock initORM
jest.mock('../../src/utils/init_ORM', () => {
  return jest.fn().mockImplementation(() => ({
    findOne: jest.fn(),
    find: jest.fn(),
    persistAndFlush: jest.fn()
  }));
});

describe('Transaction Middlewares', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe('idValidator', () => {
    it('should pass valid id', () => {
      mockRequest.params = { id: '123' };
      idValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject invalid id format', () => {
      mockRequest.params = { id: 'abc' };
      idValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Enter a valid ID" });
    });

    it('should reject missing id', () => {
      mockRequest.params = {};
      idValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Enter a valid ID" });
    });
  });

  describe('pageLimitValidator', () => {
    it('should pass valid page and limit', () => {
      mockRequest.query = { page: '1', limit: '10' };
      pageLimitValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject non-numeric values', () => {
      mockRequest.query = { page: 'abc', limit: 'def' };
      pageLimitValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Page and Limit must be numbers" });
    });

    it('should reject negative values', () => {
      mockRequest.query = { page: '-1', limit: '0' };
      pageLimitValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Enter valid page and limit" });
    });

    it('should reject limit exceeding maximum', () => {
      mockRequest.query = { page: '1', limit: '501' };
      pageLimitValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Limit cannot be greater than 500" });
    });
  });

  describe('newEntryValidator', () => {
    beforeEach(() => {
      const mockEM = {
        findOne: jest.fn()
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);
    });

    it('should pass valid transaction data', async () => {
      mockRequest.body = {
        description: 'Test',
        originalAmount: 100,
        currency: 'USD',
        date: '2024-01-01'
      };

      await newEntryValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject invalid schema', async () => {
      mockRequest.body = {
        description: 'Test'
      };

      await newEntryValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: '"originalAmount" is required' });
    });

    it('should reject invalid date format', async () => {
      mockRequest.body = {
        description: 'Test',
        originalAmount: 100,
        currency: 'USD',
        date: '01-01-2024'
      };

      await newEntryValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date format. Expected format: YYYY-MM-DD",
      });
    });

    it('should reject invalid date value', async () => {
      mockRequest.body = {
        description: 'Test',
        originalAmount: 100,
        currency: 'USD',
        date: '2024-02-30'
      };

      await newEntryValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date value",
      });
    });

    it('should handle duplicate transaction', async () => {
      mockRequest.body = {
        description: 'Test',
        originalAmount: 100,
        currency: 'USD',
        date: '2024-01-01'
      };

      const mockEM = {
        findOne: jest.fn().mockResolvedValue({ id: 1 })
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await newEntryValidator(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "A transaction with the same date and description already exists",
      });
    });
  });

  describe('validateUpdate', () => {
    beforeEach(() => {
      const mockEM = {
        findOne: jest.fn()
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);
    });

    it('should pass valid update data', async () => {
      mockRequest.body = {
        description: 'Updated Test',
        originalAmount: 200,
        currency: 'EUR',
        date: '2024-01-02'
      };
      mockRequest.params = { id: '1' };

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject invalid data types', async () => {
      mockRequest.body = {
        description: 123,
        originalAmount: 'invalid'
      };

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);

    });

    it('should reject invalid date format', async () => {
      mockRequest.body = {
        date: '01-01-2024'
      };

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date format. Expected format: YYYY-MM-DD"
      });
    });

    it('should reject invalid date value', async () => {
      mockRequest.body = {
        date: '2024-02-30'
      };

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date value",
      });
    });

    it('should reject negative amount', async () => {
      mockRequest.body = {
        originalAmount: -100
      };

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Amount cannot be negative'
      });
    });

    it('should handle duplicate transaction', async () => {
      mockRequest.body = {
        date: '2024-01-01',
        description: 'Test'
      };
      mockRequest.params = { id: '1' };

      const mockEM = {
        findOne: jest.fn().mockResolvedValue({ id: 2 })
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await validateUpdate(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Transaction with same date and description already exists'
      });
    });
  });

  describe('checkSoftDeleted', () => {
    it('should pass non-deleted transaction', async () => {
      mockRequest.params = { id: '1' };
      const mockEM = {
        findOne: jest.fn().mockResolvedValue({ id: 1, isDeleted: false })
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await checkSoftDeleted(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject soft-deleted transaction', async () => {
      mockRequest.params = { id: '1' };
      const mockEM = {
        findOne: jest.fn().mockResolvedValue({ id: 1, isDeleted: true })
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await checkSoftDeleted(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Cannot perform action on a soft-deleted transaction"
      });
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      const mockEM = {
        findOne: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await checkSoftDeleted(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(logger.error).toHaveBeenCalledWith("Error checking soft-deleted transaction:", expect.any(Error));
      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle missing transaction', async () => {
      mockRequest.params = { id: '1' };
      const mockEM = {
        findOne: jest.fn().mockResolvedValue(null)
      };
      (require('../../src/utils/init_ORM') as jest.Mock).mockResolvedValue(mockEM);

      await checkSoftDeleted(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});