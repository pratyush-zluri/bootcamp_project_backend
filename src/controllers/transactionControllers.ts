import { Request, Response } from 'express';
import { MikroORM } from '@mikro-orm/core'
import { Transaction } from '../entities/transactions'
import config from '../../mikro-orm.config';

export class transactionController {
    public async addTransaction(req: Request, res: Response) {
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

    public async getTransactions(req: Request, res: Response) {
        try {
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const data = await em.find(Transaction, {}, {orderBy: {date:'DESC'}});
            const count=await em.count(Transaction);
            console.log(count);
            res.send(data);
        } catch (err) {
            console.log(err);
        }
    }

    public async updateTransaction(req: Request, res: Response) {
        try {
            const id=parseInt(req.params.id);
            if(!id){
                res.status(404).send("Transaction not found");
            }
            const orm = await MikroORM.init(config);
            const em = orm.em.fork();
            const transaction=await em.findOne(Transaction,id);
            if(!transaction){
                res.status(404).send("Transaction not found");
            }
            const { description, originalAmount, currency } = req.body;
            transaction!.date = new Date();
            if(description!==undefined){
                transaction!.description=description;
            }
            if(originalAmount!==undefined){
                transaction!.originalAmount=originalAmount;
            }
            if(currency!==undefined){
                transaction!.currency=currency;
            }
            await em.flush();
            res.status(200).send("Transaction updated successfully");
            await orm.close();
        } catch (err) {
            console.log(err);
        }
    }

    public async deleteTransaction(req:Request, res: Response){
        try{
            const orm= await MikroORM.init(config);
            const em=orm.em.fork();
            const id:number=Number(req.params.id);
            const transaction=await em.findOne(Transaction,id);
            console.log(transaction);
            if(!transaction){
                res.status(404).send("Transaction not found");
                return;
            }
            const result=await em.remove(transaction).flush();
            res.send("Transaction deleted successfully");
        } catch(err){
            console.log(err);
        }
    }
    
}




