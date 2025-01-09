import express from 'express'
import { transactionController } from '../controllers/transactionControllers';

const router=express.Router();
const tc=new transactionController();

router.get('/', tc.getData)

router.post('/newData',tc.insertTransaction)

export default router;

