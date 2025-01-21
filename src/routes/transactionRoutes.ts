import express from 'express';
import {
    getTransactions,
    getSoftDeletedTransactions,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    downloadTransactionsCSV,
    addTransaction,
    softDeleteTransaction,
    batchSoftDeleteTransactions,
} from '../controllers/transactionControllers';
import { parseCsv } from '../controllers/parseCSV';
import multer from 'multer';
import {
    idValidator,
    newEntryValidator,
    pageLimitValidator,
    checkSoftDeleted,
    validateUpdate,
} from '../middlewares/transactionMiddlewares';
import { validateCSVFile, validateCSVData } from '../middlewares/csvMiddleware';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/transactions', pageLimitValidator, getTransactions);
router.get('/transactions/soft-deleted', getSoftDeletedTransactions);
router.post('/transactions', newEntryValidator, addTransaction);
router.patch('/transactions/:id', idValidator, checkSoftDeleted, validateUpdate, updateTransaction);
router.delete('/transactions/:id', idValidator, deleteTransaction);
router.post('/transactions/upload-csv', upload.single('file'), validateCSVFile, validateCSVData, parseCsv);
router.patch('/transactions/:id/soft-delete', idValidator, softDeleteTransaction);
router.patch('/transactions/:id/restore', idValidator, restoreTransaction);
router.get('/transactions/export-csv', downloadTransactionsCSV);
router.put('/transactions/batch-soft-delete', batchSoftDeleteTransactions);
export default router;
