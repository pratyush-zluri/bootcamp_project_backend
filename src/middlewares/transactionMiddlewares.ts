
import { Request, Response, NextFunction } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";

export class middlewares {
    public async idValidator(req: Request, res: Response, next: NextFunction) {
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
    
            // Validate if required fields are provided
            if (!description || !originalAmount || !currency) {
                res.status(400).send("Incomplete details");
                return;
            }
    
            // Validate if originalAmount is a number
            if (typeof originalAmount !== "number") {
                res.status(400).send("Amount should be a number");
                return;
            }
    
            // Initialize ORM and check for existing transaction
            const orm = await MikroORM.init(config);
            const em = await orm.em.fork();
            const date = new Date();
    
            // Check if a transaction with the same description and date already exists
            const existingTransaction = await em.findOne(Transaction, { date, description });
    
            // If a transaction exists with the same description and date, return error
            if (existingTransaction !== undefined) {
                res.status(400).send("Transaction already exists");
                return;
            }
    
            // If all validations pass, proceed to the next middleware
            console.log("All details are valid, calling next...");
            next();
        } catch (err) {
            console.error("Error in newEntryValidator:", err);
            next(err); // Pass error to the next middleware
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

    public async validateUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { description, originalAmount, currency } = req.body;
    
            if (description !== undefined && typeof description !== "string") {
                res.status(400).send("Description should be a string");
                return;
            }
    
            if (originalAmount !== undefined && typeof originalAmount !== "number") {
                res.status(400).send("Amount should be a number");
                return;
            }
    
            if (currency !== undefined && typeof currency !== "string") {
                res.status(400).send("Currency should be a string");
                return;
            }
    
            next();
        } catch (err) {
            console.error("Validation error:", err);
            res.status(500).send("An error occurred during validation");
        }
    }
    

}