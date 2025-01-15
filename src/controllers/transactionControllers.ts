import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import config from '../../mikro-orm.config';
import Joi from 'joi';
import winston from 'winston';
import { parseAsync } from 'json2csv';
import currencyConversionRates from "../globals/currencyConversionRates";

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

export class transactionController {
    private initORM = async () => {
        try {
            const orm = await MikroORM.init(config);
            return orm.em.fork();
        } catch (error) {
            logger.error("Error initializing ORM:", error);
            throw new Error("Database connection error");
        }
    };

    public getConversionRate(currency: string): number {
        const rate = currencyConversionRates[currency];
        if (rate === undefined) {
          throw new Error(`Conversion rate for currency ${currency} not found`);
        }
        return rate;
      }
    
      public addTransaction = async (req: Request, res: Response): Promise<void> => {
        try {
          const em = await this.initORM();
          const { description, originalAmount, currency } = req.body;
    
          const transaction = new Transaction();
          transaction.date = new Date();
          transaction.description = description;
          transaction.currency = currency;
          transaction.originalAmount = originalAmount;
    
          try {
            const exchangeRate = this.getConversionRate(currency);
            transaction.amount_in_inr = originalAmount * exchangeRate;
          } catch (error) {
            res.status(400).send("Invalid currency");
            return;
          }
          await em.persistAndFlush(transaction);
          res.status(201).send(transaction);
        } catch (err) {
          logger.error("Error adding transaction:", err);
          res.status(500).send('An error occurred while adding the transaction');
        }
      };
    

    public getTransactions = async (req: Request, res: Response): Promise<void> => {
        try {
            const em = await this.initORM();
            const data = await em.find(Transaction, { isDeleted: false }, { orderBy: { date: 'DESC' } });
            if (data.length === 0) {
                res.status(404).send("No transactions found");
                return;
            }
            res.send(data);
        } catch (err) {
            logger.error("Error fetching transactions:", err);
            res.status(500).send('An error occurred while fetching transactions');
        }
    };

    public getSoftDeletedTransactions = async (req: Request, res: Response): Promise<void> => {
        try {
            const em = await this.initORM();
            const data = await em.find(Transaction, { isDeleted: true }, { orderBy: { date: 'DESC' } });
            if (data.length === 0) {
                res.status(404).send("No transactions found");
                return;
            }
            res.send(data);
        } catch (err) {
            logger.error("Error fetching transactions:", err);
            res.status(500).send('An error occurred while fetching transactions');
        }
    };

    public updateTransaction = async (req: Request, res: Response): Promise<void> => {
        try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) {
            res.status(404).send("Transaction not found");
            return;
          }
    
          const em = await this.initORM();
          const transaction = await em.findOne(Transaction, id);
          if (!transaction) {
            res.status(404).send("Transaction not found");
            return;
          }
    
          if (transaction.isDeleted) {
            res.status(400).send("Cannot update a soft-deleted transaction");
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
    
          try {
            const exchangeRate = this.getConversionRate(transaction.currency);
            transaction.amount_in_inr = transaction.originalAmount * exchangeRate;
            if (isNaN(transaction.amount_in_inr)) {
              throw new Error("Invalid amount_in_inr value");
            }
          } catch (error) {
            res.status(400).send("Invalid currency or amount");
            return;
          }
    
          await em.flush();
          res.status(200).send("Transaction updated successfully");
        } catch (err) {
          logger.error("Error updating transaction:", err);
          res.status(500).send('An error occurred while updating the transaction');
        }
      };

    public deleteTransaction = async (req: Request, res: Response): Promise<void> => {
        try {
            const em = await this.initORM();
            const id = Number(req.params.id);
            if (isNaN(id)) {
                res.status(404).send("Transaction not found");
                return;
            }
            const transaction = await em.findOne(Transaction, id);
            if (!transaction) {
                res.status(404).send("Transaction not found");
                return;
            }
            if (transaction.isDeleted) {
                res.status(400).send("Cannot hard delete a soft-deleted transaction");
                return;
            }
            await em.removeAndFlush(transaction);
            res.status(200).send("Transaction deleted successfully");
        } catch (err) {
            logger.error("Error deleting transaction:", err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    };

    public softDeleteTransaction = async (req: Request, res: Response): Promise<void> => {
        try {
            const em = await this.initORM();
            const id = Number(req.params.id);
            if (isNaN(id)) {
                res.status(404).send("Transaction not found");
                return;
            }
            const transaction = await em.findOne(Transaction, id);
            if (!transaction) {
                res.status(404).send("Transaction not found");
                return;
            }
            transaction.isDeleted = true;
            await em.flush();
            res.send(transaction);
        } catch (err) {
            logger.error("Error soft-deleting transaction:", err);
            res.status(500).send('An error occurred while deleting the transaction');
        }
    };

    public restoreTransaction = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(404).send("Transaction not found or not soft-deleted");
                return;
            }

            const em = await this.initORM();6
            const transaction = await em.findOne(Transaction, { id, isDeleted: true });
            if (!transaction) {
                res.status(404).send("Transaction not found or not soft-deleted");
                return;
            }

            transaction.isDeleted = false;
            await em.flush();
            res.status(200).send("Transaction restored successfully");
        } catch (err) {
            logger.error("Error restoring transaction:", err);
            res.status(500).send("An error occurred while restoring the transaction");
        }
    };

    public downloadTransactionsCSV = async (req: Request, res: Response): Promise<void> => {
        try {
            const em = await this.initORM();
            const transactions = await em.find(Transaction, { isDeleted: false });
            const csv = await parseAsync(transactions, { fields: ['id', 'date', 'description', 'originalAmount', 'currency', 'amount_in_inr'] });
            res.header('Content-Type', 'text/csv');
            res.attachment('transactions.csv');
            res.send(csv);
        } catch (err) {
            logger.error("Error downloading transactions as CSV:", err);
            res.status(500).send('An error occurred while downloading transactions');
        }
    };
}