import { Request, Response } from 'express';
import TransactionService from '../services/transactionServices';
import { parseAsync } from 'json2csv';
import logger from '../utils/logger';

// Add Transaction
export const addTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { description, originalAmount, currency, date } = req.body;

        if (!description || !originalAmount || !currency || !date) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }

        const transaction = await TransactionService.addTransaction({ description, originalAmount, currency, date });
        res.status(201).json(transaction);
    } catch (err: any) {
        logger.error("Error adding transaction:", err);
        if (err.message && err.message.startsWith(`Conversion rate for currency`)) {
            res.status(400).json({ message: `${err.message}` });
        } else {
            res.status(500).json({ message: 'An error occurred while adding the transaction' });
        }
    }

};

// Get Transactions
export const getTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const page: number = parseInt(req.query.page as string, 10) || 1;
        const limit: number = parseInt(req.query.limit as string, 10) || 10;
        const [transactions, total] = await TransactionService.getTransactions(page, limit);

        if (typeof total !== 'number') {
            logger.error('Invalid total count:', total);
            res.status(500).json({ message: 'An error occurred while fetching transactions' });
            return;
        }

        res.status(200).json({
            transactions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        logger.error('Error fetching transactions:', err);
        res.status(500).json({ message: 'An error occurred while fetching transactions' });
    }
};

// Get Soft Deleted Transactions
export const getSoftDeletedTransactions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const { transactions, total } = await TransactionService.getSoftDeletedTransactions(page, limit);
        res.status(200).json({
            transactions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        logger.error("Error fetching soft-deleted transactions:", err);
        res.status(500).json({ message: 'An error occurred while fetching soft-deleted transactions' });
    }
};

// Update Transaction
export const updateTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        const { description, originalAmount, currency, date } = req.body;
        const transaction = await TransactionService.updateTransaction(id, { description, originalAmount, currency, date });
        res.status(200).json({ message: "Transaction updated successfully", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ message: "Transaction not found" });
        } else if (err.message.startsWith("Conversion rate for currency")) {
            res.status(400).json({ message: err.message });
        } else if (err.message === "Invalid date format") {
            res.status(400).json({ message: "Invalid date format" });
        } else if (err.message === "Cannot update a soft-deleted transaction") {
            res.status(403).json({ message: "Transaction is soft-deleted and cannot be updated" });
        } else {
            logger.error("Error updating transaction:", err);
            res.status(500).json({ message: 'An error occurred while updating the transaction' });
        }
    }
};

// Delete Transaction
export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json({ message: 'Invalid id format' });
            return;
        }

        await TransactionService.deleteTransaction(id);
        res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ message: "Transaction not found" });
        } else {
            logger.error("Error deleting transaction:", err);
            res.status(500).json({ message: 'An error occurred while deleting the transaction' });
        }
    }
};

// Soft Delete Transaction
export const softDeleteTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json({ message: 'Invalid id format' });
            return;
        }

        const transaction = await TransactionService.softDeleteTransaction(id);
        res.json({ message: "Transaction soft deleted", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found") {
            res.status(404).json({ message: "Transaction not found" });
        } else if (err.message === "Transaction already soft-deleted") {
            res.status(400).json({ message: "Transaction already soft-deleted" });
        } else {
            logger.error("Error soft-deleting transaction:", err);
            res.status(500).json({ message: 'An error occurred while deleting the transaction' });
        }
    }
};

// Restore Transaction
export const restoreTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            res.status(400).json({ message: 'Invalid id format' });
            return;
        }

        const transaction = await TransactionService.restoreTransaction(id);
        res.status(200).json({ message: "Transaction restored successfully", transaction });
    } catch (err: any) {
        if (err.message === "Transaction not found or not soft-deleted") {
            res.status(404).json({ message: "Transaction not found or not soft-deleted" });
        } else {
            logger.error("Error restoring transaction:", err);
            res.status(500).json("An error occurred while restoring the transaction");
        }
    }
};

// Download Transactions as CSV
export const downloadTransactionsCSV = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactions = await TransactionService.getTransactionsCSV();
        if (transactions.length === 0) {
            logger.error('No transactions available to download');
            res.status(404).json({ message: 'No transactions available to download' });
            return;
        }
        const csv = await parseAsync(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });
        res.header('Content-Type', 'text/csv');
        res.attachment('transactions.csv');
        res.send(csv);
    } catch (err) {
        logger.error("Error downloading transactions as CSV:", err);
        res.status(500).json({ message: 'An error occurred while downloading transactions' });
    }
};

// Batch Soft Delete Transactions
export const batchSoftDeleteTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ids }: { ids: string[] } = req.body; // Explicitly type 'ids' as an array of strings

        // Parse the IDs to integers
        const parsedIds = ids.map((id: string) => parseInt(id, 10)); // Explicitly type 'id' as a string

        // Validate that all IDs are numbers
        if (!Array.isArray(parsedIds) || parsedIds.some(isNaN)) {
            res.status(400).json({ message: "Invalid IDs format. Please provide an array of numbers." });
            return;
        }

        // Proceed with the batch soft delete
        const transactions = await TransactionService.batchSoftDeleteTransactions(parsedIds);
        res.json({ message: "Transactions soft deleted", transactions });
    } catch (err: any) {
        logger.error("Error batch soft-deleting transactions:", err);
        res.status(500).json({ message: 'An error occurred while batch deleting transactions' });
    }
};

export const searchAllTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = req.query.query as string;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const { transactions, total } = await TransactionService.searchAllTransactions(query, page, limit);
        res.status(200).json({
            transactions,
            page,
            limit,
            total,
        });
    } catch (err: any) {
        logger.error("Error searching transactions:", err);
        res.status(500).json({ message: 'An error occurred while searching transactions' });
    }
};

export const batchHardDeleteTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ids }: { ids: string[] } = req.body; // Explicitly type 'ids' as an array of strings

        // Parse the IDs to integers
        const parsedIds = ids.map((id: string) => parseInt(id, 10)); // Explicitly type 'id' as a string

        // Validate that all IDs are numbers
        if (!Array.isArray(parsedIds) || parsedIds.some(isNaN)) {
            res.status(400).json({ message: "Invalid IDs format. Please provide an array of numbers." });
            return;
        }

        // Proceed with the batch hard delete
        await TransactionService.batchHardDeleteTransactions(parsedIds);
        res.json({ message: "Transactions permanently deleted" });
    } catch (err: any) {
        logger.error("Error batch hard deleting transactions:", err);
        res.status(500).json({ message: 'An error occurred while batch deleting transactions' });
    }
};

export const batchRestoreTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ids }: { ids: string[] } = req.body; // Explicitly type 'ids' as an array of strings

        // Parse the IDs to integers
        const parsedIds = ids.map((id: string) => parseInt(id, 10)); // Explicitly type 'id' as a string

        // Validate that all IDs are numbers
        if (!Array.isArray(parsedIds) || parsedIds.some(isNaN)) {
            res.status(400).json({ message: "Invalid IDs format. Please provide an array of numbers." });
            return;
        }

        // Proceed with the batch restore
        await TransactionService.batchRestoreTransactions(parsedIds);
        res.json({ message: "Transactions restored" });
    } catch (err: any) {
        logger.error("Error batch restoring transactions:", err);
        res.status(500).json({ message: 'An error occurred while batch restoring transactions' });
    }
};
