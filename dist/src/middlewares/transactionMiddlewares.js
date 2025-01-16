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
exports.middlewares = void 0;
const core_1 = require("@mikro-orm/core");
const mikro_orm_config_1 = __importDefault(require("../../mikro-orm.config"));
const joi_1 = __importDefault(require("joi"));
const winston_1 = __importDefault(require("winston"));
const transactions_1 = require("../entities/transactions");
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console()
    ],
});
class middlewares {
    idValidator(req, res, next) {
        const idParam = req.params.id;
        if (!idParam || isNaN(parseInt(idParam))) {
            res.status(400).send("Enter valid id");
            return;
        }
        next();
    }
    newEntryValidator(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                description: joi_1.default.string().required(),
                originalAmount: joi_1.default.number().required().min(0),
                currency: joi_1.default.string().required(),
            });
            const { error } = schema.validate(req.body);
            if (error) {
                res.status(400).send(error.details[0].message);
                return;
            }
            try {
                const orm = yield core_1.MikroORM.init(mikro_orm_config_1.default);
                const em = orm.em.fork();
                const { description, originalAmount, currency } = req.body;
                const date = new Date();
                const existingTransaction = yield em.findOne(transactions_1.Transaction, { date, description });
                if (existingTransaction) {
                    res.status(400).send("Transaction already exists");
                    return;
                }
                next();
            }
            catch (err) {
                logger.error("Error in newEntryValidator:", err);
                next(err);
            }
        });
    }
    validateUpload(req, res, next) {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        if (file.mimetype !== "text/csv") {
            res.status(400).json({ error: "Invalid file type. Please upload a CSV file." });
            return;
        }
        if (file.size > 1048576) {
            res.status(400).json({ error: "File size exceeds the 1 MB limit." });
            return;
        }
        next();
    }
    validateUpdate(req, res, next) {
        const schema = joi_1.default.object({
            description: joi_1.default.string().optional(),
            originalAmount: joi_1.default.number().optional().min(0),
            currency: joi_1.default.string().optional(),
        });
        const { error } = schema.validate(req.body);
        if (error) {
            res.status(400).send(error.details[0].message);
            return;
        }
        next();
    }
    checkNotSoftDeleted(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orm = yield core_1.MikroORM.init(mikro_orm_config_1.default);
                const em = orm.em.fork();
                const id = parseInt(req.params.id);
                const transaction = yield em.findOne(transactions_1.Transaction, id);
                if (transaction && transaction.isDeleted) {
                    res.status(400).send("Cannot perform action on a soft-deleted transaction");
                    return;
                }
                next();
            }
            catch (err) {
                logger.error("Error checking soft-deleted transaction:", err);
                next(err);
            }
        });
    }
}
exports.middlewares = middlewares;
