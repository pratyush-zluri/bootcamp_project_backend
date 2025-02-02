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
    Amount: Joi.number().required().greater(0),
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
    if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
    }

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

        if (fileContent.trim().length === 0) {
            await fs.unlink(file.path);
            res.status(400).json({ message: "The uploaded CSV file is empty." });
            return;
        }

        const result: ParseResult<Data> = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            dynamicTyping: true,
        });

        const errors: string[] = [];
        const validData: Data[] = [];
        const duplicateRows: Data[] = [];
        const seenEntries = new Set<string>();

        for (const row of result.data) {
            let date = row.Date;

            const ddMMyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;
            if (ddMMyyyyRegex.test(date)) {
                const [day, month, year] = date.split('-');
                date = `${year}-${month}-${day}`;
            }

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

            if (date < '1990-01-01') {
                const errorMsg = `Invalid date value in row: ${JSON.stringify(row)} - ${row.Date}, date cannot be older than 1990-01-01`;
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

            const key = `${date}|${row.Description}`;
            if (seenEntries.has(key)) {
                duplicateRows.push(row);
                continue;
            }
            seenEntries.add(key);
            validData.push(row);
        }

        if (validData.length === 0) {
            await fs.unlink(file.path);
            res.status(400).json({
                error: "No valid transactions to upload",
                errors,
                duplicateRows,
            });
            return;
        }

        req.body = req.body || {};
        req.body.validData = validData;
        req.body.errors = errors;
        req.body.duplicateRows = duplicateRows;
        next();
    } catch (err) {
        logger.error("Error processing CSV file:", err);
        res.status(500).json({ message: "An error occurred while processing the CSV file" });
    }
};

export { validateCSVFile, validateCSVData };