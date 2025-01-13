import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import config from '../../mikro-orm.config';

export class transactionController {
    constructor() {
        this.addTransaction = this.addTransaction.bind(this);
        this.getTransactions = this.getTransactions.bind(this);
        this.updateTransaction = this.updateTransaction.bind(this);
        this.deleteTransaction = this.deleteTransaction.bind(this);
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

    public async addTransaction(req: Request, res: Response): Promise<void> {
        try {
            const orm = await MikroORM.init(config);
            const transaction = new Transaction();
            const { description, originalAmount, currency } = req.body;

            if (!description || !originalAmount || !currency) {
                res.status(400).send("Incomplete details");
                return;
            }

            const amountInINR = await this.convertCurrency(currency, originalAmount);

            transaction.date = new Date();
            transaction.description = description;
            transaction.currency = currency;
            transaction.originalAmount = originalAmount;
            transaction.amount_in_inr = amountInINR;

            const em = orm.em.fork();
            await em.persist(transaction).flush();
            res.status(201).send(transaction);
            await orm.close();
        } catch (err) {
            console.error('Error adding transaction:', err);
            res.status(500).send('An error occurred while adding the transaction');
        }
    }

    public async getTransactions(req: Request, res: Response): Promise<void> {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const data = await em.find(Transaction, {isDeleted: false}, { orderBy: { date: 'DESC' } });
            res.send(data);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while fetching transactions');
        }
    }

    public async updateTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            if (!id) {
                res.status(404).send("Transaction not found");
                return;
            }
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const transaction = await em.findOne(Transaction, id);
            if (!transaction) {
                res.status(404).send("Transaction not found");
                return;
            }
            const { description, originalAmount, currency } = req.body;
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
            res.status(200).send("Transaction updated successfully");
            await orm.close();
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while updating the transaction');
        }
    }

    public async deleteTransaction(req: Request, res: Response): Promise<void> {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const id = Number(req.params.id);
            const transaction = await em.findOne(Transaction, id);
            if (!transaction) {
                res.status(404).send("Transaction not found");
                return;
            }
            await em.remove(transaction).flush();
            res.send("Transaction deleted successfully");
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    }

    public async softDeleteTransaction(req: Request, res: Response): Promise<void> {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const id = Number(req.params.id);
            const transaction = await em.findOne(Transaction, id);
    
            if (!transaction) {
                res.status(404).send("Transaction not found");
                return;
            }
            transaction.isDeleted = true;
            await em.flush();
    
            res.send("Transaction soft deleted successfully");
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    }
    
    public async restoreTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
    
            const transaction = await em.findOne(Transaction, { id, isDeleted: true });
            if (!transaction) {
                res.status(404).send("Transaction not found or not soft-deleted");
                return;
            }
    
            transaction.isDeleted = false;
            await em.flush();
    
            res.status(200).send("Transaction restored successfully");
            await orm.close();
        } catch (err) {
            console.error("Error restoring transaction:", err);
            res.status(500).send("An error occurred while restoring the transaction");
        }
    }
    

}
