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

jest.mock('../../src/globals/currencyConversionRates', () => ({
  __esModule: true,
  default: {
    USD: 83.12,
    EUR: 89.44,
    GBP: 104.70,
  }
}));

import { parseCSV } from '../../src/controllers/parseCSV';
import { MikroORM } from '@mikro-orm/core';
import Papa from 'papaparse';
import fs from 'fs/promises';
import winston from 'winston';

// Additional mocks
jest.mock('fs/promises');
jest.mock('papaparse');

// Mock currencyConversionRates
jest.mock('../../src/globals/currencyConversionRates', () => ({
  __esModule: true,
  default: {
    USD: 83.12,
    EUR: 89.44,
    GBP: 104.70,
  }
}));

describe('parseCSV', () => {
  let parser: parseCSV;
  let mockEM: any;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock EM
    mockEM = {
      find: jest.fn(),
      persistAndFlush: jest.fn(),
      fork: jest.fn().mockReturnThis(),
    };

    // Mock MikroORM.init
    (MikroORM.init as jest.Mock).mockResolvedValue({
      em: {
        fork: () => mockEM
      }
    });

    // Setup mock request and response
    mockReq = {
      file: {
        path: 'test.csv'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Initialize parser
    parser = new parseCSV();
  });

  it('should handle missing file', async () => {
    mockReq.file = null;

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
  });

  it('should successfully parse valid CSV data', async () => {
    const mockData = [{
      Date: '01-01-2024',
      Description: 'Test Transaction',
      Amount: 100,
      Currency: 'USD'
    }];

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({
      data: mockData
    });
    mockEM.find.mockResolvedValue([]);

    await parser.parseCsv(mockReq, mockRes);

    expect(mockEM.persistAndFlush).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: '1 Transactions uploaded successfully',
      repeats: [],
      errors: []
    });
  });

  it('should handle duplicate entries in CSV', async () => {
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
    

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({ data: mockData });
    mockEM.find.mockResolvedValue([]);

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: '1 Transactions uploaded successfully',
      repeats: [mockData[1]],
      errors: []
    });
  });


describe('parseCSV - getConversionRate', () => {
  let parser: parseCSV;

  beforeEach(() => {
    parser = new parseCSV();
  });

  it('should return the correct conversion rate for a valid currency', () => {
    const usdRate = parser.getConversionRate('USD');
    const eurRate = parser.getConversionRate('EUR');
    const gbpRate = parser.getConversionRate('GBP');

    expect(usdRate).toBe(83.12);
    expect(eurRate).toBe(89.44);
    expect(gbpRate).toBe(104.70);
  });

  it('should throw an error for an invalid currency', () => {
    expect(() => parser.getConversionRate('INVALID')).toThrowError('Conversion rate for currency INVALID not found');
  });
});


  it('should handle invalid data in CSV', async () => {
    const mockData = [{
      Date: 'invalid-date',
      Description: 'Test Transaction',
      Amount: -100,
      Currency: 'INVALID'
    }];

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({ data: mockData });

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'No valid transactions to upload',
      repeats: [],
      errors: expect.any(Array)
    });
  });

  it('should handle empty fields in CSV', async () => {
    const mockData = [{
      Date: '',
      Description: '',
      Amount: null,
      Currency: ''
    }];

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({ data: mockData });

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'No valid transactions to upload',
      repeats: [],
      errors: expect.any(Array)
    });
  });

  it('should handle database connection error', async () => {
    (MikroORM.init as jest.Mock).mockRejectedValue(new Error('DB Connection Error'));

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'An error occurred while processing the CSV file'
    });
  });

  it('should handle existing transactions in database', async () => {
    const mockData = [{
      Date: '01-01-2024',
      Description: 'Test Transaction',
      Amount: 100,
      Currency: 'USD'
    }];

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({ data: mockData });
    
    mockEM.find.mockResolvedValue([{
      date: new Date('2024-01-01'),
      description: 'Test Transaction'
    }]);

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: '0 Transactions uploaded successfully',
      repeats: [mockData[0]],
      errors: []
    });
  });

  it('should handle file deletion error', async () => {
    (fs.unlink as jest.Mock).mockRejectedValue(new Error('Delete Error'));
    const mockData = [{
      Date: '01-01-2024',
      Description: 'Test Transaction',
      Amount: 100,
      Currency: 'USD'
    }];

    (fs.readFile as jest.Mock).mockResolvedValue('csv content');
    (Papa.parse as jest.Mock).mockReturnValue({ data: mockData });
    mockEM.find.mockResolvedValue([]);

    await parser.parseCsv(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
  });
});