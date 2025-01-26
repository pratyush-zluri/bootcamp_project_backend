import { EntityManager } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import initORM from '../utils/init_ORM';
import { currencyConversionRates } from "../globals/currencyConversionRates";
import { isValid } from 'date-fns';

class TransactionService {

    public getConversionRate(currency: string, date: string): number {
        console.log('Checking conversion rate for:', { date, currency });
        const fallbackRate = currencyConversionRates.get(currency);
        if (fallbackRate === undefined) {
            throw new Error(`Conversion rate for currency ${currency} not found for date ${date}`);
        }

        return fallbackRate;
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

        const exchangeRate = this.getConversionRate(data.currency, transactionDate.toISOString().split('T')[0]);
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

        const exchangeRate = this.getConversionRate(transaction.currency, transaction.date.toISOString().split('T')[0]);
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