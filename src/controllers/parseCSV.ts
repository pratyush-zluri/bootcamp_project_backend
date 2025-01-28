import fs from "fs/promises";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import initORM from "../utils/init_ORM";
import { isValid, parse, format } from "date-fns";
import logger from "../utils/logger";
import transactionServices from "../services/transactionServices";
import { parseAsync } from "json2csv";

type Data = {
    Date: string;
    Description: string;
    Amount: number;
    Currency: string;
};

const formatDate = (dateString: string): Date => {
    return parse(dateString, 'dd-MM-yyyy', new Date());
};

export const parseCsv = async (req: Request, res: Response): Promise<void> => {
    try {
        const em = await initORM();
        const { validData = [], errors = [], duplicateRows = [] }: { validData: Data[]; errors: string[]; duplicateRows: Data[] } = req.body;
        const repeatsInDB: Data[] = [];
        const transactions: Transaction[] = [];
        const seenEntries = new Set<string>();

        const dateDescriptionPairs = validData.map((data) => ({
            date: formatDate(data.Date),
            description: data.Description.trim().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim(),
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
            // Normalize description by removing extra spaces and trimming
            const normalizedDescription = row.Description.trim().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();

            if (row.Amount < 0) {
                const errorMsg = `Negative amount in row: ${JSON.stringify(row)} - ${row.Amount}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }

            const key = `${parsedDate.toISOString().split('T')[0]}|${normalizedDescription}`;
            if (existingSet.has(key)) {
                repeatsInDB.push(row);
                continue;
            }

            if (seenEntries.has(key)) {
                duplicateRows.push(row);
                continue;
            }

            seenEntries.add(key);

            let conversionRate;
            try {
                conversionRate = transactionServices.getConversionRate(row.Currency.toUpperCase(), row.Date.split('T')[0]);
            } catch (error) {
                const errorMsg = `Error getting conversion rate for currency: ${row.Currency.toUpperCase()}`;
                logger.error(errorMsg, error);
                errors.push(errorMsg);
                continue;
            }

            const transaction = new Transaction();
            transaction.date = parsedDate;
            transaction.description = normalizedDescription;
            transaction.originalAmount = row.Amount;
            transaction.currency = row.Currency.toUpperCase();
            transaction.amount_in_inr = row.Amount * conversionRate;

            transactions.push(transaction);
        }

        if (transactions.length > 0) {
            await em.persistAndFlush(transactions);
        }

        const csv = await parseAsync(transactions, {
            fields: ["id", "date", "description", "originalAmount", "currency", "amount_in_inr"],
        });

        res.status(201).json({
            message: transactions.length === 0
                ? "No transactions were uploaded."
                : `${transactions.length} Transactions uploaded successfully`,
            transactions,
            duplicateRows,
            repeatsInDB,
            errors,
        });

        if (req.file?.path) {
            await fs.unlink(req.file.path);
        }
    } catch (err: any) {
        logger.error("Error processing CSV file:", err);
        res.status(500).json({
            message: "An error occurred while processing the CSV file",
        });
    }
};