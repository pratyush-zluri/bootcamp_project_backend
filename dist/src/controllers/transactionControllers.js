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
exports.transactionController = void 0;
const core_1 = require("@mikro-orm/core");
const transactions_1 = require("../entities/transactions");
const mikro_orm_config_1 = __importDefault(require("../../mikro-orm.config"));
const winston_1 = __importDefault(require("winston"));
const json2csv_1 = require("json2csv");
const currencyConversionRates_1 = __importDefault(require("../globals/currencyConversionRates"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console()
    ],
});
class transactionController {
    constructor() {
        this.initORM = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const orm = yield core_1.MikroORM.init(mikro_orm_config_1.default);
                return orm.em.fork();
            }
            catch (error) {
                logger.error("Error initializing ORM:", error);
                throw new Error("Database connection error");
            }
        });
        this.addTransaction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const { description, originalAmount, currency } = req.body;
                const transaction = new transactions_1.Transaction();
                transaction.date = new Date();
                transaction.description = description;
                transaction.currency = currency;
                transaction.originalAmount = originalAmount;
                try {
                    const exchangeRate = this.getConversionRate(currency);
                    transaction.amount_in_inr = originalAmount * exchangeRate;
                }
                catch (error) {
                    res.status(400).send("Invalid currency");
                    return;
                }
                yield em.persistAndFlush(transaction);
                res.status(201).send(transaction);
            }
            catch (err) {
                logger.error("Error adding transaction:", err);
                res.status(500).send('An error occurred while adding the transaction');
            }
        });
        this.getTransactions = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const data = yield em.find(transactions_1.Transaction, { isDeleted: false }, { orderBy: { date: 'DESC' } });
                if (data.length === 0) {
                    res.status(404).send("No transactions found");
                    return;
                }
                res.send(data);
            }
            catch (err) {
                logger.error("Error fetching transactions:", err);
                res.status(500).send('An error occurred while fetching transactions');
            }
        });
        this.getSoftDeletedTransactions = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const data = yield em.find(transactions_1.Transaction, { isDeleted: true }, { orderBy: { date: 'DESC' } });
                if (data.length === 0) {
                    res.status(404).send("No transactions found");
                    return;
                }
                res.send(data);
            }
            catch (err) {
                logger.error("Error fetching transactions:", err);
                res.status(500).send('An error occurred while fetching transactions');
            }
        });
        this.updateTransaction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                const em = yield this.initORM();
                const transaction = yield em.findOne(transactions_1.Transaction, id);
                if (!transaction) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                if (transaction.isDeleted) {
                    res.status(400).send("Cannot update a soft-deleted transaction");
                    return;
                }
                const { description, originalAmount, currency } = req.body;
                transaction.date = new Date();
                if (description !== undefined) {
                    transaction.description = description;
                }
                if (originalAmount !== undefined) {
                    transaction.originalAmount = originalAmount;
                }
                if (currency !== undefined) {
                    transaction.currency = currency;
                }
                try {
                    const exchangeRate = this.getConversionRate(transaction.currency);
                    transaction.amount_in_inr = transaction.originalAmount * exchangeRate;
                    if (isNaN(transaction.amount_in_inr)) {
                        throw new Error("Invalid amount_in_inr value");
                    }
                }
                catch (error) {
                    res.status(400).send("Invalid currency or amount");
                    return;
                }
                yield em.flush();
                res.status(200).send("Transaction updated successfully");
            }
            catch (err) {
                logger.error("Error updating transaction:", err);
                res.status(500).send('An error occurred while updating the transaction');
            }
        });
        this.deleteTransaction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const id = Number(req.params.id);
                if (isNaN(id)) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                const transaction = yield em.findOne(transactions_1.Transaction, id);
                if (!transaction) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                if (transaction.isDeleted) {
                    res.status(400).send("Cannot hard delete a soft-deleted transaction");
                    return;
                }
                yield em.removeAndFlush(transaction);
                res.status(200).send("Transaction deleted successfully");
            }
            catch (err) {
                logger.error("Error deleting transaction:", err);
                res.status(500).send('An error occurred while deleting the transaction');
            }
        });
        this.softDeleteTransaction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const id = Number(req.params.id);
                if (isNaN(id)) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                const transaction = yield em.findOne(transactions_1.Transaction, id);
                if (!transaction) {
                    res.status(404).send("Transaction not found");
                    return;
                }
                transaction.isDeleted = true;
                yield em.flush();
                res.send(transaction);
            }
            catch (err) {
                logger.error("Error soft-deleting transaction:", err);
                res.status(500).send('An error occurred while deleting the transaction');
            }
        });
        this.restoreTransaction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(404).send("Transaction not found or not soft-deleted");
                    return;
                }
                const em = yield this.initORM();
                6;
                const transaction = yield em.findOne(transactions_1.Transaction, { id, isDeleted: true });
                if (!transaction) {
                    res.status(404).send("Transaction not found or not soft-deleted");
                    return;
                }
                transaction.isDeleted = false;
                yield em.flush();
                res.status(200).send("Transaction restored successfully");
            }
            catch (err) {
                logger.error("Error restoring transaction:", err);
                res.status(500).send("An error occurred while restoring the transaction");
            }
        });
        this.downloadTransactionsCSV = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const em = yield this.initORM();
                const transactions = yield em.find(transactions_1.Transaction, { isDeleted: false });
                const csv = yield (0, json2csv_1.parseAsync)(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });
                res.header('Content-Type', 'text/csv');
                res.attachment('transactions.csv');
                res.send(csv);
            }
            catch (err) {
                logger.error("Error downloading transactions as CSV:", err);
                res.status(500).send('An error occurred while downloading transactions');
            }
        });
    }
    getConversionRate(currency) {
        const rate = currencyConversionRates_1.default[currency];
        if (rate === undefined) {
            throw new Error(`Conversion rate for currency ${currency} not found`);
        }
        return rate;
    }
}
exports.transactionController = transactionController;
