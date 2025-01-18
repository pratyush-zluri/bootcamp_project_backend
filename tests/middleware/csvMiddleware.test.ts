import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import Papa from 'papaparse';
import { validateCSVFile, validateCSVData } from '../../src/middlewares/csvMiddleware';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('papaparse');
jest.mock('../../src/utils/logger');

describe('CSV Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('validateCSVFile', () => {
    it('should call next() if file exists', () => {
      mockRequest = {
        file: {
          fieldname: 'file',
          originalname: 'test.csv',
          encoding: '7bit',
          mimetype: 'text/csv',
          destination: './uploads',
          filename: 'test.csv',
          path: './uploads/test.csv',
          size: 1024,
        },
      };

      validateCSVFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if no file is uploaded', () => {
      mockRequest = {
        file: undefined,
      };

      validateCSVFile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateCSVData', () => {
    it('should validate and process valid CSV data', async () => {
      const validCSVContent = 'Date,Description,Amount,Currency\n2025-01-18,Test Transaction,100,USD';
      const mockValidData = [{
        Date: '2025-01-18',
        Description: 'Test Transaction',
        Amount: 100,
        Currency: 'USD'
      }];

      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 1000,
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValue(validCSVContent);
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockValidData,
        errors: []
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({
        validData: mockValidData,
        errors: []
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle dd-MM-yyyy date format', async () => {
      const csvContent = 'Date,Description,Amount,Currency\n18-01-2025,Test Transaction,100,USD';
      const expectedData = [{
        Date: '18-01-2025',
        Description: 'Test Transaction',
        Amount: 100,
        Currency: 'USD'
      }];

      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 1000,
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValue(csvContent);
      (Papa.parse as jest.Mock).mockReturnValue({
        data: expectedData,
        errors: []
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject files larger than 1MB', async () => {
      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 2000000, // 2MB
        },
      };

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'File size exceeds the 1 MB limit.'
      });
    });

    it('should reject non-CSV files', async () => {
      mockRequest = {
        file: {
          path: './uploads/test.txt',
          mimetype: 'text/plain',
          size: 1000,
        },
      };

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid file type. Please upload a CSV file.'
      });
    });

    it('should handle invalid date formats', async () => {
      const invalidCSVContent = 'Date,Description,Amount,Currency\ninvalid-date,Test Transaction,100,USD';

      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 1000,
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValue(invalidCSVContent);
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{
          Date: 'invalid-date',
          Description: 'Test Transaction',
          Amount: 100,
          Currency: 'USD'
        }],
        errors: []
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No valid transactions to upload',
          errors: expect.arrayContaining([
            expect.stringContaining('Invalid date format in row')
          ])
        })
      );
    });

    it('should handle file read errors', async () => {
      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 1000,
        },
      };

      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File read error'));

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'An error occurred while processing the CSV file'
      });
    });

    it('should validate required fields', async () => {
      const invalidCSVContent = 'Date,Description,Amount,Currency\n2025-01-18,,100,USD';

      mockRequest = {
        file: {
          path: './uploads/test.csv',
          mimetype: 'text/csv',
          size: 1000,
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValue(invalidCSVContent);
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{
          Date: '2025-01-18',
          Description: '',
          Amount: 100,
          Currency: 'USD'
        }],
        errors: []
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No valid transactions to upload',
          errors: expect.arrayContaining([
            expect.stringContaining('Validation error in row')
          ])
        })
      );
    });
  });
});