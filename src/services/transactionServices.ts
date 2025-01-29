import { EntityManager } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import initORM from '../utils/init_ORM';
import { currencyConversionRates } from "../globals/currencyConversionRates";
import { isValid } from 'date-fns';
import { parseStringPromise } from 'xml2js';
import axios from 'axios';
import { error } from 'console';

const exchangeRateCache: Map<string, number> = new Map();
class TransactionService {

    public async getCurrencyConversion(Currency: string, date: string): Promise<number> {
        try {
            // Step 1: Get EUR to INR exchange rate for the given date
            const eurToInrUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.INR.EUR.SP00.A?startPeriod=${date}&endPeriod=${date}&type=jsondata`;
            const eurToInrResponse = await axios.get(eurToInrUrl, { headers: { Accept: "application/xml" } });
            const eurToInrXml = eurToInrResponse.data as string; // Cast to string
            const eurToInrData = await parseStringPromise(eurToInrXml, { explicitArray: false });
            const eurToInrRate = parseFloat(
                eurToInrData[`message:GenericData`][`message:DataSet`][`generic:Series`][`generic:Obs`][`generic:ObsValue`][`$`][`value`]
            );
            if (!eurToInrRate) {
                throw new Error("EUR to INR conversion rate not found.");
            }
            console.log(`EUR to INR Rate for ${date}: ${eurToInrRate}`);
            // Step 2: Get EUR to SGD exchange rate for the given date
            const eurToSgdUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.${Currency}.EUR.SP00.A?startPeriod=${date}&endPeriod=${date}&type=jsondata`;
            const eurToSgdResponse = await axios.get(eurToSgdUrl, { headers: { Accept: "application/xml" } });
            const eurToSgdXml = eurToSgdResponse.data as string; // Cast to string
            const eurToSgdData = await parseStringPromise(eurToSgdXml, { explicitArray: false });
            const eurToSgdRate = parseFloat(
                eurToSgdData["message:GenericData"]["message:DataSet"]["generic:Series"]["generic:Obs"]["generic:ObsValue"]["$"]["value"]
            );
            if (!eurToSgdRate) {
                throw new Error("Conversion rate for currency.");
            }
            console.log(`EUR to SGD Rate for ${date}: ${eurToSgdRate}`);
            // Step 3: Convert SGD to INR using the rates
            const sgdToInr = eurToInrRate / eurToSgdRate; // SGD to INR using EUR as intermediary
            // Step 4: Return the conversion rate
            console.log(`Exchange Rate (SGD to INR): ${sgdToInr}`);
            return sgdToInr;
        } catch (error) {
            console.error("Error fetching currency data:");
            throw error;
        }
    }

    public getConversionRate(currency: string, date: string): number {
        console.log('Checking conversion rate for:', { date, currency });
        const fallbackRate = currencyConversionRates.get(currency);
        if (fallbackRate === undefined) {
            throw new Error(`Conversion rate for currency ${currency} not found for date ${date}`);
        }

        return fallbackRate;
    }


    private async getCachedExchangeRate(currency: string, date: string): Promise<number> {
        const cacheKey = `${currency}-${date}`;
        if (exchangeRateCache.has(cacheKey)) {
            return exchangeRateCache.get(cacheKey)!;
        }

        let exchangeRate: number;
        try {
            exchangeRate = await this.getCurrencyConversion(currency, date);
        } catch (error: any) {
            console.warn("Falling back to static conversion rates due to error:", error.message);
            exchangeRate = this.getConversionRate(currency, date);
        }

        exchangeRateCache.set(cacheKey, exchangeRate);
        return exchangeRate;
    }



    public async addTransaction(data: { description: string; originalAmount: number; currency: string; date: string }) {
        const em = await initORM();
        const transaction = new Transaction();
        const transactionDate = new Date(data.date);

        if (!isValid(transactionDate)) {
            throw new Error("Invalid date format");
        }

        transaction.date = transactionDate;
        transaction.description = data.description;
        transaction.currency = data.currency;
        transaction.originalAmount = data.originalAmount;

        const exchangeRate = await this.getCachedExchangeRate(data.currency, transactionDate.toISOString().split('T')[0]);

        transaction.amount_in_inr = data.originalAmount * exchangeRate;

        await em.persistAndFlush(transaction);
        return transaction;
    }
    public async getTransactions(page: number, limit: number) {
        const em: EntityManager = await initORM();
        const offset: number = (page - 1) * limit;

        const [transactions, total] = await em.findAndCount(
            Transaction,
            { isDeleted: false },
            {
                orderBy: { date: 'DESC' },
                offset: offset,
                limit: limit,
            }
        );

        return [transactions, total];
    }

    public async getSoftDeletedTransactions(page: number, limit: number) {
        const em = await initORM();
        const offset = (page - 1) * limit;
        const [transactions, total] = await em.findAndCount(Transaction, { isDeleted: true }, {
            orderBy: { date: 'DESC' },
            offset: offset,
            limit: limit
        });
        return { transactions, total };
    }

    public async updateTransaction(id: number, data: { description?: string; originalAmount?: number; currency?: string; date?: string }) {
        const em = await initORM();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error("Transaction not found");
        }

        if (transaction.isDeleted) {
            throw new Error("Cannot update a soft-deleted transaction");
        }

        if (data.date !== undefined) {
            const transactionDate = new Date(data.date);
            if (!isValid(transactionDate)) {
                throw new Error("Invalid date format");
            }
            transaction.date = transactionDate;
        }
        if (data.description !== undefined) {
            transaction.description = data.description;
        }
        if (data.originalAmount !== undefined) {
            transaction.originalAmount = data.originalAmount;
        }
        if (data.currency !== undefined) {
            transaction.currency = data.currency;
        }
        const existingTransaction = await em.findOne(Transaction, { date: transaction.date, description: transaction.description });

        if (existingTransaction) {
            throw new Error("A transaction with the same date and description already exists");
            return;
        }

        const exchangeRate = await this.getCachedExchangeRate(transaction.currency, transaction.date.toISOString().split('T')[0]);

        transaction.amount_in_inr = transaction.originalAmount * exchangeRate;

        await em.flush();
        return transaction;
    }

    public async deleteTransaction(id: number) {
        const em = await initORM();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error("Transaction not found");
        }
        await em.removeAndFlush(transaction);
    }

    public async softDeleteTransaction(id: number) {
        const em = await initORM();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error("Transaction not found");
        }
        if (transaction.isDeleted) {
            throw new Error("Transaction already soft-deleted");
        }
        transaction.isDeleted = true;
        await em.flush();
        return transaction;
    }

    public async restoreTransaction(id: number) {
        const em = await initORM();
        const transaction = await em.findOne(Transaction, { id, isDeleted: true });
        if (!transaction) {
            throw new Error("Transaction not found or not soft-deleted");
        }
        transaction.isDeleted = false;
        await em.flush();
        return transaction;
    }

    public async getTransactionsCSV() {
        const em = await initORM();
        const transactions = await em.find(Transaction, { isDeleted: false });
        return transactions;
    }

    public async batchSoftDeleteTransactions(ids: number[]) {
        const em = await initORM();
        const transactions = await em.find(Transaction, { id: { $in: ids }, isDeleted: false });
        if (!transactions.length) {
            throw new Error("No transactions found to delete");
        }

        transactions.forEach(transaction => (transaction.isDeleted = true));
        await em.flush();

        return transactions;
    }
    public async searchAllTransactions(query: string, page: number, limit: number) {
        const em = await initORM();
        const regex = new RegExp(query, 'i'); // Case-insensitive search
        const offset: number = (page - 1) * limit;
        const [transactions, total] = await em.findAndCount(Transaction, {
            $or: [
                { description: regex },
                { currency: regex },
            ],
            isDeleted: false
        }, {
            orderBy: { date: 'DESC' },
            offset: offset,
            limit: limit,
        });

        return { transactions, total };
    }

    public async batchHardDeleteTransactions(ids: number[]) {
        const em = await initORM();
        const transactions = await em.find(Transaction, { id: { $in: ids }, isDeleted: true });
        if (!transactions.length) {
            throw new Error("No transactions found to delete");
        }

        await em.removeAndFlush(transactions);

        return transactions;
    }

    public async batchRestoreTransactions(ids: number[]) {
        const em = await initORM();
        const transactions = await em.find(Transaction, { id: { $in: ids }, isDeleted: true });
        if (!transactions.length) {
            throw new Error("No transactions found to restore");
        }

        transactions.forEach(transaction => (transaction.isDeleted = false));
        await em.flush();

        return transactions;
    }

    public async findTransaction(date: string, description: string): Promise<Transaction | null> {
        const em = await initORM();
        const transaction = await em.findOne(Transaction, {
            date: new Date(date),
            description: description,
            isDeleted: false
        });
        return transaction;
    }
}

export default new TransactionService();