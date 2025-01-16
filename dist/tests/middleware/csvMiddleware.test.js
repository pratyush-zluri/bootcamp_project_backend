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
const csvMiddleware_1 = require("../../src/middlewares/csvMiddleware");
const promises_1 = __importDefault(require("fs/promises"));
const papaparse_1 = __importDefault(require("papaparse"));
jest.mock('fs/promises');
jest.mock('papaparse');
describe('CSV Middleware', () => {
    let mockRequest;
    let mockResponse;
    let mockNext;
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
            mockRequest.file = { path: 'dummy/path' };
            (0, csvMiddleware_1.validateCSVFile)(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 400 if no file is uploaded', () => {
            (0, csvMiddleware_1.validateCSVFile)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
        });
    });
    describe('validateCSVData', () => {
        beforeEach(() => {
            promises_1.default.readFile.mockResolvedValue('  Date , Description , Amount , Currency \n25-07-2019,Test,10,USD\n');
        });
        it('should validate CSV data and call next', () => __awaiter(void 0, void 0, void 0, function* () {
            papaparse_1.default.parse.mockReturnValue({
                data: [{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }],
                errors: []
            });
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRequest.body.validData).toEqual([{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }]);
            expect(mockRequest.body.errors).toEqual([]);
        }));
        it('should return 400 if no valid data', () => __awaiter(void 0, void 0, void 0, function* () {
            papaparse_1.default.parse.mockReturnValue({
                data: [{ Date: '', Description: 'Test', Amount: 10, Currency: 'USD' }],
                errors: []
            });
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'No valid transactions to upload',
                errors: expect.any(Array)
            });
        }));
        it('should handle file reading errors', () => __awaiter(void 0, void 0, void 0, function* () {
            promises_1.default.readFile.mockRejectedValue(new Error('File read error'));
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'An error occurred while processing the CSV file' });
        }));
        it('should handle parse errors', () => __awaiter(void 0, void 0, void 0, function* () {
            papaparse_1.default.parse.mockImplementation(() => {
                throw new Error('Parse error');
            });
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'An error occurred while processing the CSV file' });
        }));
        it('should handle rows with validation errors', () => __awaiter(void 0, void 0, void 0, function* () {
            papaparse_1.default.parse.mockReturnValue({
                data: [{ Date: '', Description: 'Test', Amount: 10, Currency: 'USD' }],
                errors: []
            });
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'No valid transactions to upload',
                errors: expect.any(Array)
            });
        }));
        it('should transform headers by trimming them', () => __awaiter(void 0, void 0, void 0, function* () {
            papaparse_1.default.parse.mockReturnValue({
                data: [{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }],
                errors: []
            });
            mockRequest.file = { path: 'dummy/path' };
            mockRequest.body = {};
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRequest.body.validData).toEqual([{ Date: '25-07-2019', Description: 'Test', Amount: 10, Currency: 'USD' }]);
            expect(mockRequest.body.errors).toEqual([]);
            expect(papaparse_1.default.parse).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                transformHeader: expect.any(Function)
            }));
            // Verify that the transformHeader function trims the header
            const transformHeaderFn = papaparse_1.default.parse.mock.calls[0][1].transformHeader;
            expect(transformHeaderFn('  Date ')).toBe('Date');
            expect(transformHeaderFn(' Description ')).toBe('Description');
            expect(transformHeaderFn(' Amount ')).toBe('Amount');
            expect(transformHeaderFn(' Currency ')).toBe('Currency');
        }));
        it('should return 400 if no file is uploaded', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.file = undefined; // Simulate no file uploaded
            yield (0, csvMiddleware_1.validateCSVData)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
            expect(mockNext).not.toHaveBeenCalled();
        }));
    });
});
