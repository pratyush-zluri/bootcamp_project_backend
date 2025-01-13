import Papa, { ParseResult } from "papaparse";
import fs from "fs/promises";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";
import { parse, isValid } from "date-fns";

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

    public async convertCurrency(currency: string, originalAmount: number): Promise<number> {
        const api = `https://v6.exchangerate-api.com/v6/9cb5f6ea22832f565cc716bd/latest/${currency}`;
        try {
            const response = await fetch(api);
            if (!response.ok) {
                throw new Error(`Error fetching exchange rates: ${response.statusText}`);
            }
            const data = await response.json();
            const toExchangeRate = data.conversion_rates['INR'];
            if (!toExchangeRate) {
                throw new Error('INR conversion rate not found in response');
            }
            return originalAmount * toExchangeRate;
        } catch (error) {
            console.error('Currency conversion error:', error);
            throw error;
        }
    }
    public async parseCsv(req: Request, res: Response): Promise<void> {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();

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
            for (const row of result.data) {

                const parsedDate = parse(row.Date, "dd-MM-yyyy", new Date());
                if (!isValid(parsedDate)) {
                    console.error(`Invalid date found: ${row.Date}`);
                    continue;
                }

                const existingTransaction = await em.findOne(Transaction, {
                    date: parsedDate,
                    description: row.Description,
                });
                if (existingTransaction) {
                    console.error(`Transaction already exists: ${row.Description}`);
                    continue;
                }

                const transaction = new Transaction();
                transaction.date = new Date(parsedDate);
                transaction.description = row.Description;
                transaction.originalAmount = row.Amount;
                transaction.currency = row.Currency;
                transaction.amount_in_inr = await this.convertCurrency(row.Currency, row.Amount);
                transactions.push(transaction);
            }

            if (transactions.length > 0) {
                await em.persist(transactions).flush();
                res.status(201).json({ message: "Transactions uploaded successfully" });
            } else {
                res.status(400).json({ error: "No valid transactions to upload" });
            }

            await fs.unlink(file.path);
        } catch (err) {
            console.error("Error processing CSV file:", err);
            res.status(500).json({ error: "An error occurred while processing the CSV file" });
        }
    }
}
