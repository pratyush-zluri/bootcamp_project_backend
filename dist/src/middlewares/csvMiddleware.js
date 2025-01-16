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
exports.validateCSVData = exports.validateCSVFile = void 0;
const joi_1 = __importDefault(require("joi"));
const promises_1 = __importDefault(require("fs/promises"));
const papaparse_1 = __importDefault(require("papaparse"));
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console()
    ],
});
const schema = joi_1.default.object({
    Date: joi_1.default.string().required(),
    Description: joi_1.default.string().required(),
    Amount: joi_1.default.number().required(),
    Currency: joi_1.default.string().required(),
});
const validateCSVFile = (req, res, next) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    next();
};
exports.validateCSVFile = validateCSVFile;
const validateCSVData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    try {
        // const fileContent = await fs.readFile(file.path, "utf-8");
        const fileContent = req.file.buffer.toString("utf-8");
        const result = papaparse_1.default.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            dynamicTyping: true,
        });
        const errors = [];
        const validData = [];
        for (const row of result.data) {
            const { error } = schema.validate(row);
            if (error) {
                logger.error(`Validation error: ${error.details[0].message}`);
                errors.push(`Validation error in row: ${JSON.stringify(row)} - ${error.details[0].message}`);
                continue;
            }
            validData.push(row);
        }
        if (validData.length === 0) {
            yield promises_1.default.unlink(file.path);
            res.status(400).json({
                error: "No valid transactions to upload",
                errors
            });
            return;
        }
        req.body = req.body || {};
        req.body.validData = validData;
        req.body.errors = errors;
        next();
    }
    catch (err) {
        logger.error("Error processing CSV file:", err);
        res.status(500).json({ error: "An error occurred while processing the CSV file" });
    }
});
exports.validateCSVData = validateCSVData;
