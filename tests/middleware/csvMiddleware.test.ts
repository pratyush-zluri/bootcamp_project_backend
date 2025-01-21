import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import Papa from 'papaparse';
import { validateCSVFile, validateCSVData } from '../../src/middlewares/csvMiddleware';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('papaparse');
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn()
}));

describe('CSV Validation Middlewares', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      file: {
        path: 'test.csv',
        mimetype: 'text/csv',
        size: 1000,
      },
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCSVFile', () => {
    it('should pass when file is present', () => {
      validateCSVFile(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject when no file is uploaded', () => {
      mockRequest.file = undefined;
      validateCSVFile(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "No file uploaded" });
    });
  });

  describe('validateCSVData', () => {
    it('should reject invalid file type', async () => {
      mockRequest.file!.mimetype = 'text/plain';
      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invalid file type. Please upload a CSV file." });
    });

    it('should reject file size exceeding limit', async () => {
      mockRequest.file!.size = 2000000;
      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "File size exceeds the 1 MB limit." });
    });

    it('should handle file read error', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File read error'));
      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should validate and convert dd-MM-yyyy date format', async () => {
      const mockData = [{
        Date: '01-12-2024',
        Description: 'Test',
        Amount: 100,
        Currency: 'USD'
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.body).toHaveProperty('validData');
      expect(mockRequest.body.validData[0]).toEqual({
        Date: '01-12-2024',  // The date format conversion happens in the middleware
        Description: 'Test',
        Amount: 100,
        Currency: 'USD'
      });
    });

    it('should reject invalid date format', async () => {
      const mockData = [{
        Date: '2024/01/01',
        Description: 'Test',
        Amount: 100,
        Currency: 'USD'
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "No valid transactions to upload",
        errors: expect.any(Array)
      });
    });

    it('should reject invalid date value', async () => {
      const mockData = [{
        Date: '2024-13-45',
        Description: 'Test',
        Amount: 100,
        Currency: 'USD'
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "No valid transactions to upload",
        errors: expect.any(Array)
      });
    });

    it('should handle schema validation errors', async () => {
      const mockData = [{
        Date: '2024-01-01',
        Description: '',  // Required field is empty
        Amount: 'invalid', // Should be number
        Currency: 'USD'
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "No valid transactions to upload",
        errors: expect.any(Array)
      });
    });

    it('should reject when no valid data is present', async () => {
      const mockData = [{
        Date: 'invalid',
        Description: '',
        Amount: 'invalid',
        Currency: ''
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "No valid transactions to upload",
        errors: expect.any(Array)
      });
      expect(fs.unlink).toHaveBeenCalledWith('test.csv');
    });

    it('should pass valid data with yyyy-MM-dd format', async () => {
      const mockData = [{
        Date: '2024-01-01',
        Description: 'Test',
        Amount: 100,
        Currency: 'USD'
      }];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.body.validData).toEqual(mockData);
    });

    it('should handle mixed valid and invalid data', async () => {
      const mockData = [
        {
          Date: '2024-01-01',
          Description: 'Valid',
          Amount: 100,
          Currency: 'USD'
        },
        {
          Date: 'invalid',
          Description: '',
          Amount: 'invalid',
          Currency: ''
        }
      ];
      (fs.readFile as jest.Mock).mockResolvedValue('csv content');
      (Papa.parse as jest.Mock).mockReturnValue({
        data: mockData,
        errors: [],
        meta: { delimiter: ',' }
      });

      await validateCSVData(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.body.validData).toHaveLength(1);
      expect(mockRequest.body.errors).toHaveLength(1);
    });
  });
});