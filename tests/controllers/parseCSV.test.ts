// Mock MikroORM and related modules
jest.mock('@mikro-orm/core', () => ({
  MikroORM: {
    init: jest.fn()
  },
  Entity: jest.fn(),
  Property: jest.fn(),
  PrimaryKey: jest.fn(),
  SerializedPrimaryKey: jest.fn(),
  Unique: jest.fn(),
  Enum: jest.fn(),
  Index: jest.fn()
}));

// Mock PostgreSQL driver
jest.mock('@mikro-orm/postgresql', () => ({
  PostgreSqlDriver: jest.fn()
}));

// Mock mikro-orm config
jest.mock('../../mikro-orm.config', () => ({
  __esModule: true,
  default: {
    entities: [],
    dbName: 'test_db',
    type: 'postgresql',
    driver: jest.fn()
  }
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    error: jest.fn(),
    info: jest.fn(),
  }),
  format: {
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock Transaction entity
jest.mock('../../src/entities/transactions', () => {
  class Transaction {
    id!: number;
    _id!: string;
    date!: Date;
    description!: string;
    originalAmount!: number;
    currency!: string;
    amount_in_inr!: number;
    created_at!: Date;
    updated_at!: Date;

    constructor() {
      this.created_at = new Date();
      this.updated_at = new Date();
    }
  }
  return { Transaction };
});

// Mock currency conversion rates
jest.mock('../../src/globals/currencyConversionRates', () => ({
  __esModule: true,
  default: {
    USD: 83.12,
    EUR: 89.44,
    GBP: 104.70,
  }
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined)
}));

// Mock json2csv
jest.mock('json2csv', () => ({
  parseAsync: jest.fn().mockResolvedValue('mocked,csv,content')
}));

import { parseCSV } from '../../src/controllers/parseCSV';
import { MikroORM } from '@mikro-orm/core';
import fs from 'fs/promises';
import winston from 'winston';

describe('parseCSV', () => {
  let parser: parseCSV;
  let mockEM: any;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEM = {
      find: jest.fn().mockResolvedValue([]),
      persistAndFlush: jest.fn().mockResolvedValue(undefined),
      fork: jest.fn().mockReturnThis(),
    };

    (MikroORM.init as jest.Mock).mockResolvedValue({
      em: {
        fork: () => mockEM
      }
    });

    mockReq = {
      body: {
        validData: [],
        errors: []
      },
      file: {
        path: 'test/path'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    parser = new parseCSV();
  });

  describe('getConversionRate', () => {
    it('should return correct conversion rate for valid currencies', () => {
      expect(parser.getConversionRate('USD')).toBe(83.12);
      expect(parser.getConversionRate('EUR')).toBe(89.44);
      expect(parser.getConversionRate('GBP')).toBe(104.70);
    });

    it('should throw error for invalid currency', () => {
      expect(() => parser.getConversionRate('INVALID')).toThrow('Conversion rate for currency INVALID not found');
    });
  });

  describe('parseCsv', () => {
    it('should process valid transactions successfully', async () => {
      mockReq.body.validData = [{
        Date: '01-01-2024',
        Description: 'Test Transaction',
        Amount: 100,
        Currency: 'USD'
      }];

      await parser.parseCsv(mockReq, mockRes);

      expect(mockEM.persistAndFlush).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: '1 Transactions uploaded successfully',
        processedTransactionsCSV: 'mocked,csv,content'
      }));
    });

    it('should handle duplicate entries both in CSV and database', async () => {
      const mockData = [
        {
          Date: '01-01-2024',
          Description: 'Test Transaction',
          Amount: 100,
          Currency: 'USD'
        },
        {
          Date: '01-01-2024',
          Description: 'Test Transaction',
          Amount: 100,
          Currency: 'USD'
        }
      ];

      mockReq.body.validData = mockData;
      mockEM.find.mockResolvedValue([{
        date: new Date('2024-01-01'),
        description: 'Test Transaction'
      }]);

      await parser.parseCsv(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: '0 Transactions uploaded successfully',
        repeats: expect.arrayContaining([mockData[0], mockData[1]])
      }));
    });

    it('should handle various validation errors', async () => {
      mockReq.body.validData = [
        {
          Date: 'invalid-date',
          Description: 'Test Transaction',
          Amount: 100,
          Currency: 'USD'
        },
        {
          Date: '01-01-2024',
          Description: 'Test Transaction',
          Amount: -100,
          Currency: 'USD'
        },
        {
          Date: '01-01-2024',
          Description: 'Test Transaction',
          Amount: 100,
          Currency: 'INVALID'
        }
      ];

      await parser.parseCsv(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining([
          expect.stringContaining('Invalid date'),
          expect.stringContaining('Negative amount'),
          expect.stringContaining('Unsupported currency')
        ])
      }));
    });

    it('should handle database connection error', async () => {
      (MikroORM.init as jest.Mock).mockRejectedValue(new Error('Database connection error'));

      await parser.parseCsv(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'An error occurred while processing the CSV file'
      });
    });

    it('should calculate correct currency summary', async () => {
      mockReq.body.validData = [
        {
          Date: '01-01-2024',
          Description: 'USD Transaction 1',
          Amount: 100,
          Currency: 'USD'
        },
        {
          Date: '01-01-2024',
          Description: 'USD Transaction 2',
          Amount: 200,
          Currency: 'USD'
        },
        {
          Date: '01-01-2024',
          Description: 'EUR Transaction',
          Amount: 150,
          Currency: 'EUR'
        }
      ];

      await parser.parseCsv(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        summary: {
          USD: 300,
          EUR: 150
        }
      }));
    });

    it('should handle file cleanup errors gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File deletion error'));
      mockReq.body.validData = [{
        Date: '01-01-2024',
        Description: 'Test Transaction',
        Amount: 100,
        Currency: 'USD'
      }];

      await parser.parseCsv(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(fs.unlink).toHaveBeenCalledWith('test/path');
    });
  });
});