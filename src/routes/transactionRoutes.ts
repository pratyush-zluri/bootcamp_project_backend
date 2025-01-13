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
router.post('/newData', tc.addTransaction);
router.put('/update/:id', middleware.idValdator, middleware.validateUpdate, tc.updateTransaction);
router.delete('/delete/:id', middleware.idValdator, tc.deleteTransaction);
router.post('/csv', upload.single('file'), middleware.validateUpload, pc.parseCsv);
router.delete('/softDelete/:id', middleware.idValdator, tc.softDeleteTransaction);
router.put('/restore/:id', middleware.idValdator, tc.restoreTransaction);
export default router;
