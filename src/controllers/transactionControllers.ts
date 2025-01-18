import { Request, Response } from 'express';
import TransactionService from '../services/transactionServices';
import { parseAsync } from 'json2csv';
import logger from '../utils/logger';

export const addTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { description, originalAmount, currency, date } = req.body;

        if (!description || !originalAmount || !currency || !date) {
            res.status(400).json('Missing required fields');
            return;
        }

        const transaction = await TransactionService.addTransaction({ description, originalAmount, currency, date });
        res.status(201).json(transaction);
    } catch (err) {
        logger.error("Error adding transaction:", err);
        res.status(500).json('An error occurred while adding the transaction');
    }
};

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const page: number = parseInt(req.query.page as string, 10) || 1;
        const limit: number = parseInt(req.query.limit as string, 10) || 10;

        if (isNaN(page) || isNaN(limit)) {
            res.status(400).json('Invalid page or limit values');
            return;
        }

        const data = await TransactionService.getTransactions(page, limit);
        if (data.length === 0) {
            res.status(404).json('No transactions found');
            return;
        }
        res.send(data);
    } catch (err) {
        logger.error("Error fetching transactions:", err);
        res.status(500).json('An error occurred while fetching transactions');
    }
};

export const getSoftDeletedTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await TransactionService.getSoftDeletedTransactions();
        if (data.length === 0) {
            res.status(404).json('No transactions found');
            return;
        }
        res.send(data);
    } catch (err) {
        logger.error("Error fetching transactions:", err);
        res.status(500).json('An error occurred while fetching transactions');
    }
};

export const updateTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        const { description, originalAmount, currency, date } = req.body;

        if (!description || !originalAmount || !currency || !date) {
            res.status(400).json('Missing required fields');
            return;
        }

        const transaction = await TransactionService.updateTransaction(id, { description, originalAmount, currency, date });
        res.status(200).json({ message: "Transaction updated successfully", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ error: "Transaction not found" });
        } else if (err.message.startsWith("Conversion rate for currency")) {
            res.status(400).json({ error: err.message });
        } else if (err.message === "Invalid date format") {
            res.status(400).json({ error: "Invalid date format" });
        } else if (err.message === "Cannot update a soft-deleted transaction") {
            res.status(403).json({ error: "Transaction is soft-deleted and cannot be updated" });
        } else {
            logger.error("Error updating transaction:", err);
            res.status(500).json('An error occurred while updating the transaction');
        }
    }
};

export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json('Invalid id format');
            return;
        }

        await TransactionService.deleteTransaction(id);
        res.status(200).json('Transaction deleted successfully');
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ error: "Transaction not found" });
        } else {
            logger.error("Error deleting transaction:", err);
            res.status(500).json('An error occurred while deleting the transaction');
        }
    }
};

export const softDeleteTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json('Invalid id format');
            return;
        }

        const transaction = await TransactionService.softDeleteTransaction(id);
        res.json({ message: "Transaction soft deleted", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ error: "Transaction not found" });
        } else if (err.message === "Transaction already soft-deleted") {
            res.status(400).json({ error: "Transaction already soft-deleted" });
        } else {
            logger.error("Error soft-deleting transaction:", err);
            res.status(500).json('An error occurred while deleting the transaction');
        }
    }
};

export const restoreTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json('Invalid id format');
            return;
        }

        const transaction = await TransactionService.restoreTransaction(id);
        res.status(200).json({ message: "Transaction restored successfully", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found or not soft-deleted") {
            res.status(404).json({ error: "Transaction not found or not soft-deleted" });
        } else {
            logger.error("Error restoring transaction:", err);
            res.status(500).json("An error occurred while restoring the transaction");
        }
    }
};

export const downloadTransactionsCSV = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactions = await TransactionService.getTransactionsCSV();
        if (transactions.length === 0) {
            logger.error('No transactions available to download');
            res.status(404).json('No transactions available to download');
            return;
        }
        const csv = await parseAsync(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });
        res.header('Content-Type', 'text/csv');
        res.attachment('transactions.csv');
        res.send(csv);
    } catch (err) {
        logger.error("Error downloading transactions as CSV:", err);
        res.status(500).json('An error occurred while downloading transactions');
    }
};