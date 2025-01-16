"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const parseCSV_1 = require("../../src/controllers/parseCSV");
const core_1 = require("@mikro-orm/core");
const promises_1 = __importDefault(require("fs/promises"));
describe('parseCSV', () => {
    let parser;
    let mockEM;
    let mockReq;
    let mockRes;
    beforeEach(() => {
        jest.clearAllMocks();
        mockEM = {
            find: jest.fn().mockResolvedValue([]),
            persistAndFlush: jest.fn().mockResolvedValue(undefined),
            fork: jest.fn().mockReturnThis(),
        };
        core_1.MikroORM.init.mockResolvedValue({
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
        parser = new parseCSV_1.parseCSV();
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
        it('should process valid transactions successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.body.validData = [{
                    Date: '01-01-2024',
                    Description: 'Test Transaction',
                    Amount: 100,
                    Currency: 'USD'
                }];
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockEM.persistAndFlush).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: '1 Transactions uploaded successfully',
                processedTransactionsCSV: 'mocked,csv,content'
            }));
        }));
        it('should handle duplicate entries both in CSV and database', () => __awaiter(void 0, void 0, void 0, function* () {
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
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: '0 Transactions uploaded successfully',
                repeats: expect.arrayContaining([mockData[0], mockData[1]])
            }));
        }));
        it('should handle various validation errors', () => __awaiter(void 0, void 0, void 0, function* () {
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
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                errors: expect.arrayContaining([
                    expect.stringContaining('Invalid date'),
                    expect.stringContaining('Negative amount'),
                    expect.stringContaining('Unsupported currency')
                ])
            }));
        }));
        it('should handle database connection error', () => __awaiter(void 0, void 0, void 0, function* () {
            core_1.MikroORM.init.mockRejectedValue(new Error('Database connection error'));
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'An error occurred while processing the CSV file'
            });
        }));
        it('should calculate correct currency summary', () => __awaiter(void 0, void 0, void 0, function* () {
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
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                summary: {
                    USD: 300,
                    EUR: 150
                }
            }));
        }));
        it('should handle file cleanup errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            promises_1.default.unlink.mockRejectedValue(new Error('File deletion error'));
            mockReq.body.validData = [{
                    Date: '01-01-2024',
                    Description: 'Test Transaction',
                    Amount: 100,
                    Currency: 'USD'
                }];
            yield parser.parseCsv(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(promises_1.default.unlink).toHaveBeenCalledWith('test/path');
        }));
    });
});
