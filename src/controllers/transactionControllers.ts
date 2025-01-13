import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import config from '../../mikro-orm.config';
import { transactionServices } from '../services/transactionService';

const ts = new transactionServices();

export class transactionController {
    constructor() {
        this.addTransaction = this.addTransaction.bind(this);
        this.getTransactions = this.getTransactions.bind(this);
        this.updateTransaction = this.updateTransaction.bind(this);
        this.deleteTransaction = this.deleteTransaction.bind(this);
    }

    public async getTransactions(req: Request, res: Response): Promise<void> {
        try {
            const data = await ts.getAllTransactions();;
            res.send(data);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while fetching transactions');
        }
    }

    public async addTransaction(req: Request, res: Response): Promise<void> {
        try {
            const { description, originalAmount, currency } = req.body;
            const newTransaction = await ts.addTransactionService(description, originalAmount, currency);
            res.status(201).json(newTransaction);
        } catch (err) {
            console.error('Error adding transaction:', err);
            res.status(500).send('An error occurred while adding the transaction');
        }
    }

    public async updateTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            const { description, originalAmount, currency } = req.body;
            await ts.updateTransactionService(id, description, originalAmount, currency);
            res.status(200).send('Transaction updated successfully',);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while updating the transaction');
        }
    }

    public async deleteTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            await ts.deleteTransactionService(id);
            res.status(200).send('Transaction deleted successfully');
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    }

    public async softDeleteTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            await ts.softDeleteTransactionService(id);
            res.status(200).send('Transaction soft-deleted successfully');
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    }

    public async restoreTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            await ts.restoreTransactionService(id);
            res.status(200).send('Transaction restored successfully');
        } catch (err) {
            console.error("Error restoring transaction:", err);
            res.status(500).send("An error occurred while restoring the transaction");
        }
    }


}
