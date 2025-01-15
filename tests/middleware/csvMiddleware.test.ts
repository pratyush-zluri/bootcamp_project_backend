import { validateCSVFile, validateCSVData } from '../../src/middlewares/csvMiddleware';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import Papa from 'papaparse';

jest.mock('fs/promises');
jest.mock('papaparse');

describe('CSV Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('validateCSVFile', () => {
    it('should call next if file is uploaded', () => {
      mockRequest.file = { path: 'dummy/path' } as any;
      validateCSVFile(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 if no file is uploaded', () => {
      validateCSVFile(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });
  });

  describe('validateCSVData', () => {
    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue('  Date , Description , Amount , Currency \n25-07-2019,Test,10,USD\n');
    });

    it('should validate CSV data and call next', async () => {
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }],
        errors: []
      });

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.validData).toEqual([{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }]);
      expect(mockRequest.body.errors).toEqual([]);
    });

    it('should return 400 if no valid data', async () => {
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{ Date: '', Description: 'Test', Amount: 10, Currency: 'USD' }],
        errors: []
      });

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No valid transactions to upload',
        errors: expect.any(Array)
      });
    });

    it('should handle file reading errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File read error'));

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'An error occurred while processing the CSV file' });
    });

    it('should handle parse errors', async () => {
      (Papa.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'An error occurred while processing the CSV file' });
    });

    it('should handle rows with validation errors', async () => {
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{ Date: '', Description: 'Test', Amount: 10, Currency: 'USD' }],
        errors: []
      });

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No valid transactions to upload',
        errors: expect.any(Array)
      });
    });

    it('should transform headers by trimming them', async () => {
      (Papa.parse as jest.Mock).mockReturnValue({
        data: [{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }],
        errors: []
      });

      mockRequest.file = { path: 'dummy/path' } as any;
      mockRequest.body = {};
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.validData).toEqual([{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }]);
      expect(mockRequest.body.errors).toEqual([]);
      expect(Papa.parse).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        transformHeader: expect.any(Function)
      }));

      // Verify that the transformHeader function trims the header
      const transformHeaderFn = (Papa.parse as jest.Mock).mock.calls[0][1].transformHeader;
      expect(transformHeaderFn('  Date ')).toBe('Date');
      expect(transformHeaderFn(' Description ')).toBe('Description');
      expect(transformHeaderFn(' Amount ')).toBe('Amount');
      expect(transformHeaderFn(' Currency ')).toBe('Currency');
    });

    it('should return 400 if no file is uploaded', async () => {
      mockRequest.file = undefined; // Simulate no file uploaded
      await validateCSVData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});