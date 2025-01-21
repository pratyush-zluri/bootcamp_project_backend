import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import fs from 'fs/promises';
import Papa, { ParseResult } from 'papaparse';
import { parse, isValid, format } from 'date-fns';
import logger from '../utils/logger';

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
        res.status(400).json({ message: "No file uploaded" });
        return;
    }
    next();
};

const validateCSVData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const file = req.file;
    if (file.mimetype !== "text/csv") {
        res.status(400).json({ message: "Invalid file type. Please upload a CSV file." });
        return;
    }
    if (file.size > 1048576) {
        res.status(400).json({ message: "File size exceeds the 1 MB limit." });
        return;
    }
    try {
        const fileContent = await fs.readFile(file.path, "utf-8");
        const result: ParseResult<Data> = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            dynamicTyping: true,
        });

        const errors: string[] = [];
        const validData: Data[] = [];

        for (const row of result.data) {
            let date = row.Date;

            // Convert date from dd-MM-yyyy to yyyy-MM-dd if needed
            const ddMMyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;
            if (ddMMyyyyRegex.test(date)) {
                const [day, month, year] = date.split('-');
                date = `${year}-${month}-${day}`;
            }

            // Validate date format and value
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                const errorMsg = `Invalid date format in row: ${JSON.stringify(row)} - Expected format: YYYY-MM-DD`;
                logger.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }
            const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
            if (!isValid(parsedDate) || format(parsedDate, 'yyyy-MM-dd') !== date) {
                const errorMsg = `Invalid date value in row: ${JSON.stringify(row)} - ${row.Date}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
                continue;
            }

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
        res.status(500).json({ message: "An error occurred while processing the CSV file" });
    }
};

export { validateCSVFile, validateCSVData };