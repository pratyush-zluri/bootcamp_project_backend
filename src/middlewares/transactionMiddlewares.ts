import { Request, Response, NextFunction } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import Joi from 'joi';
import logger from '../utils/logger';
import { parse, isValid, format } from 'date-fns';
import initORM from '../utils/init_ORM';

const new_schema = Joi.object({
  description: Joi.string().required(),
  originalAmount: Joi.number().required(),
  currency: Joi.string().required(),
  date: Joi.string().required(),
});

const update_schema = Joi.object({
  description: Joi.string(),
  originalAmount: Joi.number(),
  currency: Joi.string(),
  date: Joi.string(),
});

export const idValidator = (req: Request, res: Response, next: NextFunction): void => {
  const idParam = req.params.id;
  const regex = /^[0-9]+$/;

  if (!idParam || !regex.test(idParam)) {
    res.status(400).json("Enter a valid id");
    return;
  }

  next();
};

export const pageLimitValidator = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string, 10);
  const limit = parseInt(req.query.limit as string, 10);

  if (isNaN(page) || isNaN(limit)) {
    res.status(400).json("Page and limit must be numeric values");
    return;
  }

  const pageValue = page || 1;
  const limitValue = limit || 10;

  if (page < 1 || limit < 1) {
    res.status(400).json("Invalid page or limit value");
    return;
  }

  if (limit > 500) {
    res.status(400).json("Limit value too high");
    return;
  }

  next();
};

export const newEntryValidator = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { error } = new_schema.validate(req.body);
  if (error) {
    res.status(400).json(error.details[0].message);
    return;
  }

  try {
    const em = await initORM();
    const { description, originalAmount, currency, date } = req.body;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({
        success: false,
        message: "Invalid date format. Expected format: YYYY-MM-DD",
      });
      return;
    }

    const transactionDate = new Date(date);
    if (!isValid(transactionDate) || format(transactionDate, 'yyyy-MM-dd') !== date) {
      res.status(400).json({
        success: false,
        message: "Invalid date value",
      });
      return;
    }

    const existingTransaction = await em.findOne(Transaction, { date: transactionDate, description });

    if (existingTransaction) {
      res.status(400).json("Transaction already exists");
      return;
    }
    next();
  } catch (err) {
    logger.error("Error in newEntryValidator:", err);
    next(err);
  }
};

export const validateUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { error } = update_schema.validate(req.body);
  if (error) {
    res.status(400).json(error.details[0].message);
    return;
  }

  const { date, description, originalAmount, currency } = req.body;

  if ((date && typeof date !== "string") ||
    (description && typeof description !== "string") ||
    (originalAmount && typeof originalAmount !== "number") ||
    (currency && typeof currency !== "string")) {
    res.status(400).json({
      success: false,
      message: "Invalid data type",
    });
    return;
  }

  if (date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({
        success: false,
        message: "Invalid date format. Expected format: YYYY-MM-DD",
      });
      return;
    }
    const checkDate = new Date(date);
    if (!isValid(checkDate) || format(checkDate, "yyyy-MM-dd") !== date) {
      res.status(400).json({
        success: false,
        message: "Invalid date value",
      });
      return;
    }
  }

  if (originalAmount && originalAmount < 0) {
    res.status(400).json({
      success: false,
      message: 'Amount cannot be negative'
    });
    return;
  }

  if (date && description) {
    try {
      const em = await initORM();
      const duplicate = await em.findOne(Transaction, { date: new Date(date), description });
      if (duplicate && (duplicate.id !== Number(req.params.id))) {
        res.status(400).json({
          success: false,
          message: 'Transaction with same date and description already exists'
        });
        return;
      }
    } catch (err) {
      logger.error("Error in validateUpdate:", err);
      res.status(500).json({
        success: false,
        message: 'Error checking for duplicate transaction',
      });
      return;
    }
  }

  next();
};

export const checkSoftDeleted = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orm = await MikroORM.init();
    const em = orm.em.fork();
    const id = parseInt(req.params.id);
    const transaction = await em.findOne(Transaction, id);

    if (transaction && transaction.isDeleted) {
      res.status(400).json("Cannot perform action on a soft-deleted transaction");
      return;
    }
    next();
  } catch (err) {
    logger.error("Error checking soft-deleted transaction:", err);
    next(err);
  }
}