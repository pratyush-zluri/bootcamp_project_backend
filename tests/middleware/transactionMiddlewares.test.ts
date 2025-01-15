import { Request, Response, NextFunction } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { middlewares } from '../../src/middlewares/transactionMiddlewares';
import { Transaction } from '../../src/entities/transactions';

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

describe('middlewares', () => {
  let mw: middlewares;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockEM: any;

  beforeEach(() => {
    mw = new middlewares();
    mockRequest = {
      body: {},
      params: {},
      file: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    mockEM = {
      findOne: jest.fn(),
      fork: jest.fn().mockReturnThis()
    };

    (MikroORM.init as jest.Mock).mockResolvedValue({
      em: mockEM
    });
  });

  describe('idValidator', () => {
    it('should call next if id is valid', () => {
      mockRequest.params = { id: '1' };
      mw.idValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', () => {
      mockRequest.params = { id: 'invalid' };
      mw.idValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Enter valid id");
    });
  });

  describe('newEntryValidator', () => {
    it('should call next if request body is valid', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      mockEM.findOne.mockResolvedValue(null); // No existing transaction
      await mw.newEntryValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if request body is invalid', async () => {
      mockRequest.body = { description: 'Test' }; // Missing required fields
      await mw.newEntryValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if transaction already exists', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      mockEM.findOne.mockResolvedValue({}); // Existing transaction
      await mw.newEntryValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Transaction already exists");
    });

    it('should handle database errors', async () => {
      mockRequest.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      mockEM.findOne.mockRejectedValue(new Error('DB Error'));
      await mw.newEntryValidator(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('DB Error'));
    });
  });

  describe('validateUpload', () => {
    it('should call next if file is valid', () => {
      mockRequest.file = {
        mimetype: 'text/csv',
        size: 1024
      };
      mw.validateUpload(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if no file is uploaded', () => {
      mockRequest.file = undefined;
      mw.validateUpload(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "No file uploaded" });
    });

    it('should return 400 if file type is invalid', () => {
      mockRequest.file = {
        mimetype: 'application/json',
        size: 1024
      };
      mw.validateUpload(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "Invalid file type. Please upload a CSV file." });
    });

    it('should return 400 if file size exceeds limit', () => {
      mockRequest.file = {
        mimetype: 'text/csv',
        size: 2048576
      };
      mw.validateUpload(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "File size exceeds the 1 MB limit." });
    });
  });

  describe('validateUpdate', () => {
    it('should call next if request body is valid', () => {
      mockRequest.body = {
        description: 'Updated description',
        originalAmount: 200,
        currency: 'EUR'
      };
      mw.validateUpdate(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if request body is invalid', () => {
      mockRequest.body = { originalAmount: 'invalid' }; // Invalid amount type
      mw.validateUpdate(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('checkNotSoftDeleted', () => {
    it('should call next if transaction is not soft-deleted', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue({ isDeleted: false }); // Transaction is not soft-deleted
      await mw.checkNotSoftDeleted(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if transaction is soft-deleted', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockResolvedValue({ isDeleted: true }); // Transaction is soft-deleted
      await mw.checkNotSoftDeleted(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith("Cannot perform action on a soft-deleted transaction");
    });

    it('should handle database errors', async () => {
      mockRequest.params = { id: '1' };
      mockEM.findOne.mockRejectedValue(new Error('DB Error'));
      await mw.checkNotSoftDeleted(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('DB Error'));
    });
  });
});