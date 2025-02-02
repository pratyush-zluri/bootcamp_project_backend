import { Request, Response, NextFunction } from 'express';
import { MikroORM } from '@mikro-orm/core';
import { Transaction } from '../entities/transactions';
import Joi from 'joi';
import logger from '../utils/logger';
import { parse, isValid, format } from 'date-fns';
import initORM from '../utils/init_ORM';

const new_schema = Joi.object({
  description: Joi.string().required(),
  originalAmount: Joi.number().required().greater(0),
  currency: Joi.string().required(),
  date: Joi.string().required(),
});

const update_schema = Joi.object({
  description: Joi.string().optional(),
  originalAmount: Joi.number().optional().greater(0),
  currency: Joi.string().optional(),
  date: Joi.string().optional(),
});

export const idValidator = (req: Request, res: Response, next: NextFunction): void => {
  const idParam = req.params.id;
  const regex = /^[0-9]+$/;

  if (!idParam || !regex.test(idParam)) {
    res.status(400).json({
      message: "Enter a valid ID"
    });
    return;
  }

  next();
};

export const pageLimitValidator = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string, 10);
  const limit = parseInt(req.query.limit as string, 10);
  if ((page && isNaN(page)) || (limit && isNaN(limit))) {
    res.status(400).json({
      message: "Page and Limit must be numbers"
    });
    return;
  }

  const pageValue = page || 1;
  const limitValue = limit || 10;

  if (page < 1 || limit < 1) {
    res.status(400).json({
      message: "Enter valid page and limit"
    });
    return;
  }

  if (limit > 500) {
    res.status(400).json({
      message: "Limit cannot be greater than 500"
    });
    return;
  }
  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
};

export const newEntryValidator = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { error } = new_schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    res.status(400).json({
      message: errorMessages
    });
    return;
  }

  try {
    const em = await initORM();
    let { description, originalAmount, currency, date } = req.body;

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

    // Date range check
    const minValidDate = new Date('1990-01-01');
    const maxValidDate = new Date(); // Current date
    if (transactionDate < minValidDate) {
      res.status(400).json({
        success: false,
        message: "Transaction date cannot be before 1990-01-01",
      });
      return;
    }
    if (transactionDate > maxValidDate) {
      res.status(400).json({
        success: false,
        message: "Transaction date cannot be in future",
      })
      return;
    }
    description = description.trim().replace(/\s+/g, ' ');

    const existingTransaction = await em.findOne(Transaction, { date: transactionDate, description });

    if (existingTransaction) {
      res.status(400).json({
        message: "A transaction with the same date and description already exists",
      });
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
    res.status(400).json({
      message: error.details[0].message
    });
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

    const minValidDate = new Date('1990-01-01');
    const maxValidDate = new Date(); // Current date
    if (checkDate < minValidDate) {
      res.status(400).json({
        success: false,
        message: "Transaction date cannot be before 1990-01-01",
      });
      return;
    }
    if (checkDate > maxValidDate) {
      res.status(400).json({
        success: false,
        message: "Transaction date cannot be in future",
      })
      return;
    }
  }

  next();
}

export const checkSoftDeleted = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const em = await initORM();
    const id = parseInt(req.params.id);
    const transaction = await em.findOne(Transaction, id);

    if (transaction && transaction.isDeleted) {
      res.status(400).json({
        message: "Cannot perform action on a soft-deleted transaction"
      });
      return;
    }
    next();
  } catch (err) {
    logger.error("Error checking soft-deleted transaction:", err);
    next(err);
  }
}
