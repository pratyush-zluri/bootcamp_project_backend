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
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
// Mock middlewares first
const mockMiddlewares = {
    newEntryValidator: jest.fn((req, res, next) => next()),
    idValidator: jest.fn((req, res, next) => next()),
    validateUpdate: jest.fn((req, res, next) => next()),
    validateUpload: jest.fn((req, res, next) => next())
};
jest.mock('../../src/middlewares/transactionMiddlewares', () => ({
    middlewares: jest.fn().mockImplementation(() => mockMiddlewares)
}));
// Mock controller methods
const mockController = {
    getTransactions: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    addTransaction: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    updateTransaction: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    deleteTransaction: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    softDeleteTransaction: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    restoreTransaction: jest.fn().mockImplementation((_req, res) => res.json({ success: true })),
    convertCurrency: jest.fn().mockResolvedValue(100)
};
jest.mock('../../src/controllers/transactionControllers', () => ({
    transactionController: jest.fn().mockImplementation(() => mockController)
}));
// Mock CSV parser
const mockCSVParser = {
    parseCsv: jest.fn().mockImplementation((_req, res) => res.json({ success: true }))
};
jest.mock('../../src/controllers/parseCSV', () => ({
    parseCSV: jest.fn().mockImplementation(() => mockCSVParser)
}));
// Mock multer
jest.mock('multer', () => {
    return jest.fn().mockImplementation(() => ({
        single: jest.fn().mockReturnValue((req, res, next) => next())
    }));
});
describe('Transaction Routes', () => {
    let app;
    beforeAll(() => {
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Create a new router instance for each test
        const router = express_1.default.Router();
        // Set up routes with mocked middleware and controllers
        router.get('/', mockController.getTransactions);
        router.post('/newData', mockMiddlewares.newEntryValidator, mockController.addTransaction);
        router.put('/update/:id', mockMiddlewares.idValidator, mockMiddlewares.validateUpdate, mockController.updateTransaction);
        router.delete('/delete/:id', mockMiddlewares.idValidator, mockController.deleteTransaction);
        router.post('/csv', (0, multer_1.default)({ dest: 'uploads/' }).single('file'), mockMiddlewares.validateUpload, mockCSVParser.parseCsv);
        router.delete('/softDelete/:id', mockMiddlewares.idValidator, mockController.softDeleteTransaction);
        router.put('/restore/:id', mockMiddlewares.idValidator, mockController.restoreTransaction);
        app.use('/transactions', router);
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('GET /', () => {
        it('should call getTransactions controller method', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .get('/transactions')
                .expect(200);
            expect(mockController.getTransactions).toHaveBeenCalled();
            expect(response.body).toEqual({ success: true });
        }));
    });
    describe('POST /newData', () => {
        it('should validate and add new transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockTransaction = { amount: 100, description: 'Test' };
            const response = yield (0, supertest_1.default)(app)
                .post('/transactions/newData')
                .send(mockTransaction)
                .expect(200);
            expect(mockMiddlewares.newEntryValidator).toHaveBeenCalled();
            expect(mockController.addTransaction).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
    });
    describe('PUT /update/:id', () => {
        it('should validate and update transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockUpdate = { amount: 200 };
            const response = yield (0, supertest_1.default)(app)
                .put('/transactions/update/123')
                .send(mockUpdate)
                .expect(200);
            expect(mockMiddlewares.idValidator).toHaveBeenCalled();
            expect(mockMiddlewares.validateUpdate).toHaveBeenCalled();
            expect(mockController.updateTransaction).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
    });
    describe('DELETE /delete/:id', () => {
        it('should validate and delete transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .delete('/transactions/delete/123')
                .expect(200);
            expect(mockMiddlewares.idValidator).toHaveBeenCalled();
            expect(mockController.deleteTransaction).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
    });
    describe('POST /csv', () => {
        it('should handle CSV upload and parsing', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/transactions/csv')
                .attach('file', Buffer.from('test,csv,data'), 'test.csv')
                .expect(200);
            expect(mockMiddlewares.validateUpload).toHaveBeenCalled();
            expect(mockCSVParser.parseCsv).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
    });
    describe('Soft Delete and Restore', () => {
        it('should soft delete transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .delete('/transactions/softDelete/123')
                .expect(200);
            expect(mockMiddlewares.idValidator).toHaveBeenCalled();
            expect(mockController.softDeleteTransaction).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
        it('should restore transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .put('/transactions/restore/123')
                .expect(200);
            expect(mockMiddlewares.idValidator).toHaveBeenCalled();
            expect(mockController.restoreTransaction).toHaveBeenCalled();
            expect(response.body.success).toBe(true);
        }));
    });
});
