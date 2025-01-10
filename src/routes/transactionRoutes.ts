import express from 'express'
import { transactionController } from '../controllers/transactionControllers';
import { parseCSV } from '../controllers/parseCSV';
import multer from 'multer';
import { middlewares } from '../middlewares/transactionMiddlewares';


const router=express.Router();
const tc=new transactionController();
const pc=new parseCSV();
const upload = multer({ dest: 'uploads/' });
const middleware=new middlewares();

router.get('/', tc.getTransactions)

router.post('/newData',tc.addTransaction)

router.put('/update/:id',middleware.idValdator, tc.updateTransaction)

router.delete('/delete/:id', middleware.idValdator, tc.deleteTransaction);

router.post('/csv', upload.single("file"),pc.parseCsv);
export default router;