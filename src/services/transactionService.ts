import { MikroORM } from "@mikro-orm/core";
import { Transaction } from "../entities/transactions";
import config from "../../mikro-orm.config";


export class transactionServices{
    public async getAllTransactions(): Promise<Transaction[]> {
        const orm=await MikroORM.init(config);
        const em=orm.em.fork();
        const transactions=await em.find(Transaction,{});
        return transactions;
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

    public async addTransactionService(description: string, originalAmount: number, currency: string): Promise<Transaction> {
        const orm = await MikroORM.init(config);
        const transaction = new Transaction();
        const amountInINR = await this.convertCurrency(currency, originalAmount);
        transaction.date = new Date();
        transaction.description = description;
        transaction.currency = currency;
        transaction.originalAmount = originalAmount;
        transaction.amount_in_inr = amountInINR;
        const em = orm.em.fork();
        await em.persist(transaction).flush();
        await orm.close();
        return transaction;
    }

    public async updateTransactionService(id: number, description: string, originalAmount: number, currency: string): Promise<void> {
        const orm = await MikroORM.init(config);
        const em = orm.em.fork();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        transaction.date = new Date();
        if (description !== undefined) {
            transaction.description = description;
        }
        if (originalAmount !== undefined) {
            transaction.originalAmount = originalAmount;
        }
        if (currency !== undefined) {
            transaction.currency = currency;
        }
        transaction.amount_in_inr = await this.convertCurrency(transaction.currency, transaction.originalAmount);
        await em.flush();
        await orm.close();
    }

    public async deleteTransactionService(id: number): Promise<void> {
        const orm = await MikroORM.init(config);
        const em = orm.em.fork();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        await em.remove(transaction).flush();
        await orm.close();
    }

    public async softDeleteTransactionService(id: number): Promise<void> {
        const orm = await MikroORM.init(config);
        const em = orm.em.fork();
        const transaction = await em.findOne(Transaction, id);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        transaction.isDeleted = true;
        await em.flush();
        await orm.close();
    }

    public async restoreTransactionService(id: number): Promise<void> {
        const orm = await MikroORM.init(config);
        const em = orm.em.fork();
        const transaction = await em.findOne(Transaction, { id, isDeleted: true });
        if (!transaction) {
            throw new Error('Transaction not found or not soft-deleted');
        }
        transaction.isDeleted = false;
        await em.flush();
        await orm.close();
    }
    
}