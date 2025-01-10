
import { Request, Response, NextFunction } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";

export class middlewares {
    public async idValdator(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).send("Enter valid id");
                return;
            }
            next();
        } catch (err) {
            console.log(err);
        }
    }

    public async newEntryValidator(req: Request, res: Response, next: NextFunction) {
        try {
            const { description, originalAmount, currency } = req.body;
            if (!description || !originalAmount || !currency) {
                res.status(400).send("Incomplete details");
                return;
            }
            const orm = await MikroORM.init(config);
            const em = await orm.em.fork();
            const date = new Date();
            const existingTransaction = await em.findOne(Transaction, { date, description });
            if (existingTransaction) {
                res.status(400).send("Transaction already exists");
                return;
            }
            next();
        } catch (err) {

        }
    }
}