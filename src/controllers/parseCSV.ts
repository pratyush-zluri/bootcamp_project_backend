import Papa, { ParseResult } from "papaparse";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/core";
import config from "../../mikro-orm.config";
import { parse, isValid } from "date-fns";
import Joi from 'joi';
import winston from 'winston';
import currencyConversionRates from "../globals/currencyConversionRates";
import { parseAsync } from 'json2csv';

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
                entities: [Transaction]
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
        const formatDate = (dateString: string) => {
            const [day, month, year] = dateString.split("-");
            return new Date(`${year}-${month}-${day}`);
        };

        if (!req.file || !req.file.buffer) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        try {
            const em = await this.initORM();

            const csvData = req.file.buffer.toString('utf-8');
            const parsedData: ParseResult<Data> = Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true
            });

            const validData: Data[] = parsedData.data;
            const errors: string[] = [];
            const repeats: Data[] = [];
            const transactions: Transaction[] = [];
            const seenEntries = new Set<string>();
            const currencySummary: { [key: string]: number } = {};

            // Check for existing transactions in the database
            const dateDescriptionPairs = validData.map(data => ({
                date: formatDate(data.Date),
                description: data.Description
            }));

            const existingTransactions = await em.find(Transaction, { 
                $or: dateDescriptionPairs 
            });

            const existingSet = new Set(existingTransactions.map(t => `${t.date.toISOString()}|${t.description}`));

            for (const row of validData) {
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
                } catch (error) {
                    logger.error(`Error getting conversion rate for currency: ${row.Currency}`, error);
                    errors.push(`Error getting conversion rate for currency: ${row.Currency}`);
                    continue;
                }

                const transaction = new Transaction();
                transaction.date = parsedDate;
                transaction.description = row.Description;
                transaction.originalAmount = row.Amount;
                transaction.currency = row.Currency;
                transaction.amount_in_inr = row.Amount * conversionRate;

                transactions.push(transaction);

                // Update currency summary
                if (currencySummary[row.Currency]) {
                    currencySummary[row.Currency] += row.Amount;
                } else {
                    currencySummary[row.Currency] = row.Amount;
                }
            }

            if (transactions.length > 0) {
                await em.persistAndFlush(transactions);
            }

            const csv = await parseAsync(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });

            res.status(201).json({
                message: `${transactions.length} Transactions uploaded successfully`,
                repeats,
                errors,
                summary: currencySummary,
                processedTransactionsCSV: csv
            });
        } catch (err: any) {
            logger.error("Error processing CSV file:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "An error occurred while processing the CSV file" });
            }
        }
    }
}