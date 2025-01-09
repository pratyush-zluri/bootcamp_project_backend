import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core'
import { Transaction } from '../entities/transactions'
import config from '../../mikro-orm.config';

export class transactionController {
    public async insertTransaction(req: Request,res: Response) {
        try {
            const orm = await MikroORM.init(config);
            const transaction = new Transaction();
            const { description, originalAmount, currency } = req.body;
            transaction.date = new Date();
            transaction.description = description;
            transaction.currency = currency;
            transaction.originalAmount = originalAmount;
            transaction.amount_in_inr = originalAmount * 80;
            const em = orm.em.fork();
            await em.persist(transaction).flush();
            console.log(transaction.id);
            res.send();
            await orm.close();
        } catch (err) {
            console.log(err);
        }
    }

    public async getData(req:Request, res:Response) {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const data = await em.find(Transaction, {});
            res.send(data);
        } catch (err) {
            console.log(err);
        }
    }
}




