import express from 'express';
import { transactionController } from '../controllers/transactionControllers';
import { parseCSV } from '../controllers/parseCSV';
import multer from 'multer';
import { middlewares } from '../middlewares/transactionMiddlewares';

const router = express.Router();
const tc = new transactionController();
const pc = new parseCSV();
const upload = multer({ dest: 'uploads/' });
const middleware = new middlewares();

router.get('/', tc.getTransactions);
router.post('/newData',middleware.newEntryValidator, tc.addTransaction);
router.put('/update/:id', middleware.idValidator, middleware.validateUpdate, tc.updateTransaction);
router.delete('/delete/:id', middleware.idValidator, tc.deleteTransaction);
router.post('/csv', upload.single('file'), middleware.validateUpload, pc.parseCsv);
router.delete('/softDelete/:id', middleware.idValidator, tc.softDeleteTransaction);
router.put('/restore/:id', middleware.idValidator, tc.restoreTransaction);
export default router;
