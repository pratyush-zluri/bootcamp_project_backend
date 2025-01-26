import { parseCsv } from '../../src/controllers/parseCSV';
import { Transaction } from '../../src/entities/transactions';
import initORM from '../../src/utils/init_ORM';
import logger from '../../src/utils/logger';
import fs from 'fs/promises';
import { parseAsync } from 'json2csv';

// Mock all dependencies
jest.mock('../../src/utils/init_ORM');
jest.mock('../../src/utils/logger');
jest.mock('fs/promises');
jest.mock('json2csv');
jest.mock('date-fns', () => ({
    parse: jest.fn(() => new Date('2024-01-01')),
    isValid: jest.fn(() => true),
    format: jest.fn(),
}));
jest.mock('../../src/globals/currencyConversionRates', () => ({
    USD: 75,
    EUR: 85,
}));

describe('parseCsv', () => {
    let mockEm: any;
    let mockReq: any;
    let mockRes: any;
    let mockTransaction: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Transaction class
        mockTransaction = {
            date: null,
            description: '',
            originalAmount: 0,
            currency: '',
            amount_in_inr: 0,
        };
        (Transaction as jest.Mock) = jest.fn(() => mockTransaction);

        // Mock entity manager
        mockEm = {
            find: jest.fn().mockResolvedValue([]),
            persistAndFlush: jest.fn().mockResolvedValue(undefined),
        };
        (initORM as jest.Mock).mockResolvedValue(mockEm);

        // Mock response
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        // Mock request
        mockReq = {
            body: {
                validData: [],
                errors: [],
            },
            file: {
                path: 'test/path',
            },
        };

        // Mock parseAsync
        (parseAsync as jest.Mock).mockResolvedValue('mocked-csv-content');
    });


    test('should handle missing validData and errors in request body', async () => {
        mockReq.body = {};

        await parseCsv(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith({
            message: '0 Transactions uploaded successfully',
            repeats: [],
            errors: [],
        });
    });

    test('should handle negative amounts', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Negative Amount',
            Amount: -100,
            Currency: 'USD',
        }];

        await parseCsv(mockReq, mockRes);

        expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Negative amount'));
        expect(mockRes.json.mock.calls[0][0].errors).toHaveLength(1);
    });


    test('should handle duplicate entries within CSV', async () => {
        mockReq.body.validData = [
            {
                Date: '01-01-2024',
                Description: 'Duplicate',
                Amount: 100,
                Currency: 'USD',
            },
            {
                Date: '01-01-2024',
                Description: 'Duplicate',
                Amount: 100,
                Currency: 'USD',
            },
        ];

        await parseCsv(mockReq, mockRes);

        expect(mockRes.json.mock.calls[0][0].repeats).toHaveLength(1);
    });

    test('should handle existing transactions in database', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Existing',
            Amount: 100,
            Currency: 'USD',
        }];

        mockEm.find.mockResolvedValueOnce([{
            date: new Date('2024-01-01'),
            description: 'Existing',
        }]);

        await parseCsv(mockReq, mockRes);

        expect(mockRes.json.mock.calls[0][0].repeats).toHaveLength(1);
    });

    test('should handle database query error', async () => {
        mockEm.find.mockRejectedValueOnce(new Error('DB Error'));

        await parseCsv(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(logger.error).toHaveBeenCalled();
    });

    test('should handle persistAndFlush error', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Valid',
            Amount: 100,
            Currency: 'USD',
        }];
        mockEm.persistAndFlush.mockRejectedValueOnce(new Error('Save Error'));

        await parseCsv(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(logger.error).toHaveBeenCalled();
    });

    test('should handle parseAsync error', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Valid',
            Amount: 100,
            Currency: 'USD',
        }];
        (parseAsync as jest.Mock).mockRejectedValueOnce(new Error('CSV Parse Error'));

        await parseCsv(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(logger.error).toHaveBeenCalled();
    });

    test('should handle file cleanup when path exists', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Valid',
            Amount: 100,
            Currency: 'USD',
        }];

        await parseCsv(mockReq, mockRes);

        expect(fs.unlink).toHaveBeenCalledWith('test/path');
    });

    test('should skip file cleanup when path does not exist', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Valid',
            Amount: 100,
            Currency: 'USD',
        }];
        mockReq.file = undefined;

        await parseCsv(mockReq, mockRes);

        expect(fs.unlink).not.toHaveBeenCalled();
    });

    test('should handle file cleanup error', async () => {
        mockReq.body.validData = [{
            Date: '01-01-2024',
            Description: 'Valid',
            Amount: 100,
            Currency: 'USD',
        }];
        (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('Cleanup Error'));

        await parseCsv(mockReq, mockRes);

        expect(logger.error).toHaveBeenCalled();
        // Should still return success since file cleanup is not critical
        expect(mockRes.status).toHaveBeenCalledWith(201);
    });
});