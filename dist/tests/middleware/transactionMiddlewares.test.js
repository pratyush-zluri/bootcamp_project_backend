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
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mikro-orm/core");
const transactionMiddlewares_1 = require("../../src/middlewares/transactionMiddlewares");
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
    let mw;
    let mockRequest;
    let mockResponse;
    let mockNext;
    let mockEM;
    beforeEach(() => {
        mw = new transactionMiddlewares_1.middlewares();
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
        core_1.MikroORM.init.mockResolvedValue({
            em: mockEM
        });
    });
    describe('idValidator', () => {
        it('should call next if id is valid', () => {
            mockRequest.params = { id: '1' };
            mw.idValidator(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 400 if id is invalid', () => {
            mockRequest.params = { id: 'invalid' };
            mw.idValidator(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Enter valid id");
        });
    });
    describe('newEntryValidator', () => {
        it('should call next if request body is valid', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'USD'
            };
            mockEM.findOne.mockResolvedValue(null); // No existing transaction
            yield mw.newEntryValidator(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        }));
        it('should return 400 if request body is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = { description: 'Test' }; // Missing required fields
            yield mw.newEntryValidator(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        }));
        it('should return 400 if transaction already exists', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'USD'
            };
            mockEM.findOne.mockResolvedValue({}); // Existing transaction
            yield mw.newEntryValidator(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Transaction already exists");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.body = {
                description: 'Test transaction',
                originalAmount: 100,
                currency: 'USD'
            };
            mockEM.findOne.mockRejectedValue(new Error('DB Error'));
            yield mw.newEntryValidator(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(new Error('DB Error'));
        }));
    });
    describe('validateUpload', () => {
        it('should call next if file is valid', () => {
            mockRequest.file = {
                mimetype: 'text/csv',
                size: 1024
            };
            mw.validateUpload(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 400 if no file is uploaded', () => {
            mockRequest.file = undefined;
            mw.validateUpload(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "No file uploaded" });
        });
        it('should return 400 if file type is invalid', () => {
            mockRequest.file = {
                mimetype: 'application/json',
                size: 1024
            };
            mw.validateUpload(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Invalid file type. Please upload a CSV file." });
        });
        it('should return 400 if file size exceeds limit', () => {
            mockRequest.file = {
                mimetype: 'text/csv',
                size: 2048576
            };
            mw.validateUpload(mockRequest, mockResponse, mockNext);
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
            mw.validateUpdate(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 400 if request body is invalid', () => {
            mockRequest.body = { originalAmount: 'invalid' }; // Invalid amount type
            mw.validateUpdate(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });
    describe('checkNotSoftDeleted', () => {
        it('should call next if transaction is not soft-deleted', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue({ isDeleted: false }); // Transaction is not soft-deleted
            yield mw.checkNotSoftDeleted(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
        }));
        it('should return 400 if transaction is soft-deleted', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockResolvedValue({ isDeleted: true }); // Transaction is soft-deleted
            yield mw.checkNotSoftDeleted(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.send).toHaveBeenCalledWith("Cannot perform action on a soft-deleted transaction");
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.params = { id: '1' };
            mockEM.findOne.mockRejectedValue(new Error('DB Error'));
            yield mw.checkNotSoftDeleted(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(new Error('DB Error'));
        }));
    });
});
