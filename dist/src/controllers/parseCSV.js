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
exports.parseCSV = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const transactions_1 = require("../entities/transactions");
const core_1 = require("@mikro-orm/core");
const mikro_orm_config_1 = __importDefault(require("../../mikro-orm.config"));
const date_fns_1 = require("date-fns");
const winston_1 = __importDefault(require("winston"));
const currencyConversionRates_1 = __importDefault(require("../globals/currencyConversionRates"));
const json2csv_1 = require("json2csv");
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console()
    ],
});
class parseCSV {
    constructor() {
        this.parseCsv = this.parseCsv.bind(this);
    }
    initORM() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orm = yield core_1.MikroORM.init(Object.assign(Object.assign({}, mikro_orm_config_1.default), { entities: [transactions_1.Transaction] }));
                return orm.em.fork();
            }
            catch (error) {
                logger.error("Error initializing ORM:", error);
                throw new Error("Database connection error");
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
    parseCsv(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const formatDate = (dateString) => {
                const [day, month, year] = dateString.split("-");
                return new Date(`${year}-${month}-${day}`);
            };
            try {
                const em = yield this.initORM();
                const validData = req.body.validData;
                const errors = req.body.errors;
                const repeats = [];
                const transactions = [];
                const seenEntries = new Set();
                const currencySummary = {};
                // Check for existing transactions in the database
                const dateDescriptionPairs = validData.map(data => ({
                    date: formatDate(data.Date),
                    description: data.Description
                }));
                const existingTransactions = yield em.find(transactions_1.Transaction, {
                    $or: dateDescriptionPairs
                });
                const existingSet = new Set(existingTransactions.map(t => `${t.date.toISOString()}|${t.description}`));
                for (const row of validData) {
                    const parsedDate = formatDate(row.Date);
                    if (!(0, date_fns_1.isValid)(parsedDate)) {
                        logger.error(`Invalid date found: ${row.Date}`);
                        errors.push(`Invalid date in row: ${JSON.stringify(row)} - ${row.Date}`);
                        continue;
                    }
                    if (row.Amount < 0) {
                        logger.error(`Negative amount found: ${row.Amount}`);
                        errors.push(`Negative amount in row: ${JSON.stringify(row)} - ${row.Amount}`);
                        continue;
                    }
                    if (!currencyConversionRates_1.default[row.Currency]) {
                        logger.error(`Unsupported currency found: ${row.Currency}`);
                        errors.push(`Unsupported currency in row: ${JSON.stringify(row)} - ${row.Currency}`);
                        continue;
                    }
                    const key = `${parsedDate.toISOString()}|${row.Description}|${row.Amount}|${row.Currency}`;
                    if (seenEntries.has(key)) {
                        logger.error(`Duplicate entry found in CSV: ${JSON.stringify(row)}`);
                        repeats.push(row);
                        continue;
                    }
                    // Check for existing transaction in the database
                    const dbKey = `${parsedDate.toISOString()}|${row.Description}`;
                    if (existingSet.has(dbKey)) {
                        logger.error(`Transaction already exists in database: ${row.Description}`);
                        repeats.push(row);
                        continue;
                    }
                    seenEntries.add(key);
                    let conversionRate;
                    try {
                        conversionRate = this.getConversionRate(row.Currency);
                    }
                    catch (error) {
                        logger.error(`Error getting conversion rate for currency: ${row.Currency}`, error);
                        errors.push(`Error getting conversion rate for currency: ${row.Currency}`);
                        continue;
                    }
                    const transaction = new transactions_1.Transaction();
                    transaction.date = parsedDate;
                    transaction.description = row.Description;
                    transaction.originalAmount = row.Amount;
                    transaction.currency = row.Currency;
                    transaction.amount_in_inr = row.Amount * conversionRate;
                    transactions.push(transaction);
                    // Update currency summary
                    if (currencySummary[row.Currency]) {
                        currencySummary[row.Currency] += row.Amount;
                    }
                    else {
                        currencySummary[row.Currency] = row.Amount;
                    }
                }
                if (transactions.length > 0) {
                    yield em.persistAndFlush(transactions);
                }
                const csv = yield (0, json2csv_1.parseAsync)(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });
                res.status(201).json({
                    message: `${transactions.length} Transactions uploaded successfully`,
                    repeats,
                    errors,
                    summary: currencySummary,
                    processedTransactionsCSV: csv
                });
                yield promises_1.default.unlink(req.file.path);
            }
            catch (err) {
                logger.error("Error processing CSV file:", err);
                res.status(500).json({ error: "An error occurred while processing the CSV file" });
                return;
            }
        });
    }
}
exports.parseCSV = parseCSV;
