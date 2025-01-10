import Papa, { ParseResult } from "papaparse"
import fs from "fs/promises";
import { Request, Response } from "express";
import { Transaction } from "../entities/transactions";
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";
import { parse, isValid } from "date-fns";
import multer from "multer";

type data = {
    Date: string
    Description: string
    Amount: number
    Currency: string
}

export class parseCSV {
    public async parseCsv(req: Request, res: Response) {
        try {
            const orm=await MikroORM.init(config);
            const em=orm.em.fork();
            
            const file=req.file;
            console.log(file);
            if(!file){
                res.status(400).json({
                    error: "No file uploaded"
                });
                return;
            }
            const fileContent = await fs.readFile(file.path, "utf-8");
            
            const result: ParseResult<data> = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
                dynamicTyping: {
                    originalAmount: true,
                },
            })
            const transactions: Transaction[]=[];
            for(const row of result.data){
                const parsedDate = parse(row.Date, "dd-MM-yyyy", new Date());
                if (!isValid(parsedDate)) {
                    console.error(`Invalid date found: ${row.Date}`);
                    continue;
                }
                
                const transaction= new Transaction();
                transaction.date=new Date(parsedDate);
                transaction.description=row.Description;
                transaction.originalAmount=(row.Amount);
                transaction.currency=row.Currency;
                transaction.amount_in_inr=(row.Amount)*80;
                transactions.push(transaction);
            }
            const response=await em.persist(transactions).flush();
            res.json(response);
        } catch (err) {
            console.log(err);
        }
    }
}