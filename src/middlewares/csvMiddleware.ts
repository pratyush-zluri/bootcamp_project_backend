import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import fs from 'fs/promises';
import Papa, { ParseResult } from 'papaparse';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

type Data = {
    Date: string;
    Description: string;
    Amount: number;
    Currency: string;
};

const schema = Joi.object<Data>({
    Date: Joi.string().required(),
    Description: Joi.string().required(),
    Amount: Joi.number().required(),
    Currency: Joi.string().required(),
});

const validateCSVFile = (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    next();
};

const validateCSVData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }

    try {
        // const fileContent = await fs.readFile(file.path, "utf-8");
        const fileContent = req.file.buffer.toString("utf-8");
        const result: ParseResult<Data> = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            dynamicTyping: true,
        });

        const errors: string[] = [];
        const validData: Data[] = [];

        for (const row of result.data) {
            const { error } = schema.validate(row);
            if (error) {
                logger.error(`Validation error: ${error.details[0].message}`);
                errors.push(`Validation error in row: ${JSON.stringify(row)} - ${error.details[0].message}`);
                continue;
            }
            validData.push(row);
        }

        if (validData.length === 0) {
            await fs.unlink(file.path);
            res.status(400).json({
                error: "No valid transactions to upload",
                errors
            });
            return;
        }

        req.body = req.body || {};
        req.body.validData = validData;
        req.body.errors = errors;
        next();
    } catch (err) {
        logger.error("Error processing CSV file:", err);
        res.status(500).json({ error: "An error occurred while processing the CSV file" });
    }
};

export { validateCSVFile, validateCSVData };