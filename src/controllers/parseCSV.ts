import fs from "fs/promises";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import initORM from "../utils/init_ORM";
import { isValid, parse, format } from "date-fns";
import logger from "../utils/logger";
import currencyConversionRates from "../globals/currencyConversionRates";
import { parseAsync } from "json2csv";

type Data = {
    Date: string;
    Description: string;
    Amount: number;
    Currency: string;
};

const getConversionRate = (currency: string): number => {
    const rate = currencyConversionRates[currency];
    if (!rate) {
        throw new Error(`Conversion rate for currency ${currency} not found`);
    }
    return rate;
};

const formatDate = (dateString: string): Date => {
    return parse(dateString, 'dd-MM-yyyy', new Date());
};

export const parseCsv = async (req: Request, res: Response): Promise<void> => {
    try {
        const em = await initORM();
        const { validData = [], errors = [] }: { validData: Data[]; errors: string[] } = req.body;
        const repeats: Data[] = [];
        const transactions: Transaction[] = [];
        const seenEntries = new Set<string>();

        const dateDescriptionPairs = validData.map((data) => ({
            date: formatDate(data.Date),
            description: data.Description,
        }));

        const existingTransactions = await em.find(Transaction, {
            $or: dateDescriptionPairs,
        });

        const existingSet = new Set(
            existingTransactions.map(
                (transaction) =>
                    `${transaction.date.toISOString().split('T')[0]}|${transaction.description}`
            )
        );

        for (const row of validData) {
            const parsedDate = formatDate(row.Date);

            // Validate Amount
            if (row.Amount < 0) {
                const errorMsg = `Negative amount in row: ${JSON.stringify(row)} - ${row.Amount}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }

            // Validate Currency
            if (!currencyConversionRates[row.Currency]) {
                const errorMsg = `Unsupported currency in row: ${JSON.stringify(row)} - ${row.Currency}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }

            // Check for duplicates
            const key = `${parsedDate.toISOString().split('T')[0]}|${row.Description}`;
            if (seenEntries.has(key)) {
                const errorMsg = `Duplicate entry in CSV: ${JSON.stringify(row)}`;
                logger.error(errorMsg);
                repeats.push(row);
                continue;
            }

            // Check for existing transaction in DB
            if (existingSet.has(key)) {
                const errorMsg = `Transaction already exists in database: ${row.Description}`;
                logger.error(errorMsg);
                repeats.push(row);
                continue;
            }

            seenEntries.add(key);

            // Get conversion rate and create transaction
            let conversionRate;
            try {
                conversionRate = getConversionRate(row.Currency);
            } catch (error) {
                const errorMsg = `Error getting conversion rate for currency: ${row.Currency}`;
                logger.error(errorMsg, error);
                errors.push(errorMsg);
                continue;
            }

            const transaction = new Transaction();
            transaction.date = parsedDate;
            transaction.description = row.Description;
            transaction.originalAmount = row.Amount;
            transaction.currency = row.Currency;
            transaction.amount_in_inr = row.Amount * conversionRate;

            transactions.push(transaction);
        }

        // Save transactions to the database
        if (transactions.length > 0) {
            await em.persistAndFlush(transactions);
        }

        // Generate CSV of uploaded transactions
        const csv = await parseAsync(transactions, {
            fields: ["id", "date", "description", "originalAmount", "currency", "amount_in_inr"],
        });

        // Respond with success
        res.status(201).json({
            message: `${transactions.length} Transactions uploaded successfully`,
            repeats,
            errors,
        });

        // Clean up uploaded file
        if (req.file?.path) {
            await fs.unlink(req.file.path);
        }
    } catch (err: any) {
        logger.error("Error processing CSV file:", err);
        res.status(500).json({
            error: "An error occurred while processing the CSV file",
        });
    }
};