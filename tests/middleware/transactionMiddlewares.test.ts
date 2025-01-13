import { Request, Response, NextFunction } from 'express';
import { middlewares } from '../../src/middlewares/transactionMiddlewares';
import { MikroORM } from '@mikro-orm/postgresql';

// Mock MikroORM
jest.mock('@mikro-orm/postgresql', () => ({
  MikroORM: {
    init: jest.fn()
  }
}));

describe('Middlewares', () => {
  let middleware: middlewares;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new middlewares();
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('idValidator', () => {
    it('should pass validation for valid numeric id', async () => {
      req.params = { id: '123' };
      await middleware.idValidator(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation for non-numeric id', async () => {
      req.params = { id: 'abc' };
      await middleware.idValidator(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Enter valid id');
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle error case', async () => {
      req.params = undefined;
      await middleware.idValidator(req as Request, res as Response, next);
      // Verify error is logged
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('newEntryValidator', () => {
    beforeEach(() => {
      // Mock successful MikroORM initialization
      (MikroORM.init as jest.Mock).mockResolvedValue({
        em: {
          fork: () => ({
            findOne: jest.fn().mockResolvedValue(undefined)
          })
        }
      });
    });

    it('should pass validation for valid entry', async () => {
      req.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      await middleware.newEntryValidator(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail validation for missing fields', async () => {
      req.body = {
        description: 'Test transaction',
        originalAmount: 100
        // currency missing
      };
      await middleware.newEntryValidator(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Incomplete details');
    });

    it('should fail validation for non-numeric amount', async () => {
      req.body = {
        description: 'Test transaction',
        originalAmount: '100', // string instead of number
        currency: 'USD'
      };
      await middleware.newEntryValidator(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Amount should be a number');
    });

    it('should fail validation for existing transaction', async () => {
      // Mock finding an existing transaction
      (MikroORM.init as jest.Mock).mockResolvedValue({
        em: {
          fork: () => ({
            findOne: jest.fn().mockResolvedValue({ id: 1 }) // existing transaction
          })
        }
      });

      req.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      await middleware.newEntryValidator(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Transaction already exists');
    });

    it('should handle database errors', async () => {
      (MikroORM.init as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      req.body = {
        description: 'Test transaction',
        originalAmount: 100,
        currency: 'USD'
      };
      await middleware.newEntryValidator(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateUpload', () => {
    it('should pass validation for valid CSV file', async () => {
      req.file = {
        mimetype: 'text/csv',
        size: 1000000,
      } as Express.Multer.File;
      await middleware.validateUpload(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail validation when no file is uploaded', async () => {
      req.file = undefined;
      await middleware.validateUpload(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });

    it('should fail validation for non-CSV file', async () => {
      req.file = {
        mimetype: 'application/pdf',
        size: 1000000,
      } as Express.Multer.File;
      await middleware.validateUpload(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid file type. Please upload a CSV file.' });
    });

    it('should fail validation for file exceeding size limit', async () => {
      req.file = {
        mimetype: 'text/csv',
        size: 2000000,
      } as Express.Multer.File;
      await middleware.validateUpload(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'File size exceeds the 1 MB limit.' });
    });
  });

  describe('validateUpdate', () => {
    it('should pass validation for valid update data', async () => {
      req.body = {
        description: 'Updated description',
        originalAmount: 200,
        currency: 'EUR'
      };
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass validation for partial update', async () => {
      req.body = {
        description: 'Updated description'
      };
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should fail validation for invalid description type', async () => {
      req.body = {
        description: 123
      };
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Description should be a string');
    });

    it('should fail validation for invalid amount type', async () => {
      req.body = {
        originalAmount: '200'
      };
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Amount should be a number');
    });

    it('should fail validation for invalid currency type', async () => {
      req.body = {
        currency: 123
      };
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Currency should be a string');
    });

    it('should handle unexpected errors', async () => {
      req.body = null; // This will cause an error when trying to destructure
      await middleware.validateUpdate(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('An error occurred during validation');
    });
  });
});