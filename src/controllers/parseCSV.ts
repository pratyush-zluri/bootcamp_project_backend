import Papa, { ParseResult } from "papaparse";
import fs from "fs/promises";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/core";
import config from "../../mikro-orm.config";
import { parse, isValid } from "date-fns";
import Joi from 'joi';
import winston from 'winston';
import currencyConversionRates from "../globals/currencyConversionRates";

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

type Data = {
    Date: string;
    Description: string;
    Amount: number;
    Currency: string;
};

export class parseCSV {
    constructor() {
        this.parseCsv = this.parseCsv.bind(this);
    }

    private async initORM() {
        try {
            const orm = await MikroORM.init({
                ...config,
                entities: [Transaction] // Ensure the Transaction entity is included
            });
            return orm.em.fork();
        } catch (error) {
            logger.error("Error initializing ORM:", error);
            throw new Error("Database connection error");
        }
    }

    public getConversionRate(currency: string): number {
        const rate = currencyConversionRates[currency];
        if (rate === undefined) {
            throw new Error(`Conversion rate for currency ${currency} not found`);
        }
        return rate;
    }

    public async parseCsv(req: Request, res: Response): Promise<void> {
        const schema = Joi.object<Data>({
            Date: Joi.string().required(),
            Description: Joi.string().required(),
            Amount: Joi.number().required(),
            Currency: Joi.string().required(),
        });
    
        const formatDate = (dateString: string) => {
            const [day, month, year] = dateString.split("-");
            return new Date(`${year}-${month}-${day}`);
        };
    
        try {
            const em = await this.initORM();
            const file = req.file;
            if (!file) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }
    
            const fileContent = await fs.readFile(file.path, "utf-8");
            const result: ParseResult<Data> = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
                dynamicTyping: true,
            });
    
            const transactions: Transaction[] = [];
            const repeats: Data[] = [];
            const errors: string[] = [];
            const validData: Data[] = [];
            const seenEntries = new Set<string>();
    
            // Collect valid data
            for (const row of result.data) {
                // Skip rows with empty fields
                if (!row.Date || !row.Description || row.Amount == null || !row.Currency) {
                    logger.error(`Empty field found in row: ${JSON.stringify(row)}`);
                    errors.push(`Empty field found in row: ${JSON.stringify(row)}`);
                    continue;
                }
    
                const { error } = schema.validate(row);
                if (error) {
                    logger.error(`Validation error: ${error.details[0].message}`);
                    errors.push(`Validation error in row: ${JSON.stringify(row)} - ${error.details[0].message}`);
                    continue;
                }
    
                const parsedDate = formatDate(row.Date);
                if (!isValid(parsedDate)) {
                    logger.error(`Invalid date found: ${row.Date}`);
                    errors.push(`Invalid date in row: ${JSON.stringify(row)} - ${row.Date}`);
                    continue;
                }
    
                if (row.Amount < 0) {
                    logger.error(`Negative amount found: ${row.Amount}`);
                    errors.push(`Negative amount in row: ${JSON.stringify(row)} - ${row.Amount}`);
                    continue;
                }
    
                if (!currencyConversionRates[row.Currency]) {
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
    
                seenEntries.add(key);
                validData.push(row);
            }
    
            // If there are no valid data rows, return an error
            if (validData.length === 0) {
                res.status(400).json({
                    error: "No valid transactions to upload",
                    repeats,
                    errors
                });
                await fs.unlink(file.path);
                return;
            }
    
            // Batch existence check
            const dateDescriptionPairs = validData.map(data => ({
                date: formatDate(data.Date),
                description: data.Description
            }));
    
            const existingTransactions = await em.find(Transaction, { $or: dateDescriptionPairs });
            const existingSet = new Set(existingTransactions.map(t => `${t.date.toISOString()}|${t.description}`));
    
            // Process valid data and create transactions
            for (const data of validData) {
                const parsedDate = formatDate(data.Date);
                const key = `${parsedDate.toISOString()}|${data.Description}`;
    
                if (existingSet.has(key)) {
                    logger.error(`Transaction already exists: ${data.Description}`);
                    repeats.push(data);
                    continue;
                }
    
                let conversionRate;
                try {
                    conversionRate = this.getConversionRate(data.Currency);
                } catch (error) {
                    logger.error(`Error getting conversion rate for currency: ${data.Currency}`, error);
                    errors.push(`Error getting conversion rate for currency: ${data.Currency}`);
                    continue;
                }
    
                const transaction = new Transaction();
                transaction.date = parsedDate;
                transaction.description = data.Description;
                transaction.originalAmount = data.Amount;
                transaction.currency = data.Currency;
                transaction.amount_in_inr = data.Amount * conversionRate;
    
                transactions.push(transaction);
            }
    
            if (transactions.length > 0) {
                await em.persistAndFlush(transactions);
            }
    
            res.status(201).json({
                message: `${transactions.length} Transactions uploaded successfully`,
                repeats,
                errors
            });
    
            await fs.unlink(file.path);
        } catch (err:any) {
            logger.error("Error processing CSV file:", err);
            res.status(500).json({ error: "An error occurred while processing the CSV file" });
            return;
        }
    }}