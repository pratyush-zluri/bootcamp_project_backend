
import { Request, Response, NextFunction } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";
import multer from "multer";

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
            if(typeof(originalAmount)!=="number"){
                res.status(400).send("Amount should be a number");
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
            console.log(err);
        }
    }
    
    public async validateUpload(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({
                    error: "No file uploaded",
                });
                return;
            }
            if (file.mimetype !== "text/csv") {
                res.status(400).json({
                    error: "Invalid file type. Please upload a CSV file.",
                });
                return;
            }
            if (file.size > 1048576) {
                res.status(400).json({
                    error: "File size exceeds the 1 MB limit.",
                });
                return;
            }
            next();
        } catch (err) {
            console.log(err);
        }
    }

    public async validateUpdate(req: Request, res: Response, next: NextFunction) {
        try {
            const { description, originalAmount, currency } = req.body;
            if(description!==undefined){
                if(typeof(description)!=="string"){
                    res.status(400).send("Description should be a string");
                    return;
                }
            }
            if(originalAmount!==undefined){
                if(typeof(originalAmount)!=="number"){
                    res.status(400).send("Amount should be a number");
                    return;
                }
            }
            if(currency!==undefined){
                if(typeof(currency)!=="string"){
                    res.status(400).send("Currency should be a string");
                    return;
                }
            }
            if(typeof(originalAmount)!=="number"){
                res.status(400).send("Amount should be a number");
                return;
            }
            next();
        } catch (err) {
            console.log(err);
        }
    }

}