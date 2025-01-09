import express from 'express'
import { transactionController } from '../controllers/transactionControllers';

const router=express.Router();
const tc=new transactionController();

router.get('/', tc.getTransactions)

router.post('/newData',tc.addTransaction)

router.put('/update/:id', tc.updateTransaction)

export default router;

