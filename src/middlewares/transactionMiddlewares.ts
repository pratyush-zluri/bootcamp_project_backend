import { Request, Response, NextFunction } from 'express';
import { MikroORM } from '@mikro-orm/core';
import config from '../../mikro-orm.config';
import Joi from 'joi';
import winston from 'winston';
import { Transaction } from '../entities/transactions';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ],
});

export class middlewares {
  public idValidator(req: Request, res: Response, next: NextFunction): void {
    const idParam = req.params.id;
    if (!idParam || isNaN(parseInt(idParam))) {
      res.status(400).send("Enter valid id");
      return;
    }
    next();
  }

  public async newEntryValidator(req: Request, res: Response, next: NextFunction): Promise<void> {
    const schema = Joi.object({
      description: Joi.string().required(),
      originalAmount: Joi.number().required().min(0),
      currency: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).send(error.details[0].message);
      return;
    }

    try {
      const orm = await MikroORM.init(config);
      const em = orm.em.fork();
      const { description, originalAmount, currency } = req.body;
      const date = new Date();
      const existingTransaction = await em.findOne(Transaction, { date, description });

      if (existingTransaction) {
        res.status(400).send("Transaction already exists");
        return;
      }
      next();
    } catch (err) {
      logger.error("Error in newEntryValidator:", err);
      next(err);
    }
  }

  public validateUpload(req: Request, res: Response, next: NextFunction): void {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (file.mimetype !== "text/csv") {
      res.status(400).json({ error: "Invalid file type. Please upload a CSV file." });
      return;
    }
    if (file.size > 1048576) {
      res.status(400).json({ error: "File size exceeds the 1 MB limit." });
      return;
    }
    next();
  }

  public validateUpdate(req: Request, res: Response, next: NextFunction): void {
    const schema = Joi.object({
      description: Joi.string().optional(),
      originalAmount: Joi.number().optional().min(0),
      currency: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).send(error.details[0].message);
      return;
    }
    next();
  }

  public async checkNotSoftDeleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orm = await MikroORM.init(config);
      const em = orm.em.fork();
      const id = parseInt(req.params.id);
      const transaction = await em.findOne(Transaction, id);
      if (transaction && transaction.isDeleted) {
        res.status(400).send("Cannot perform action on a soft-deleted transaction");
        return;
      }
      next();
    } catch (err) {
      logger.error("Error checking soft-deleted transaction:", err);
      next(err);
    }
  }

}