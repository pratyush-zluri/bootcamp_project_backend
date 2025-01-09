import config from '../mikro-orm.config'
import express, { NextFunction } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { MikroORM } from '@mikro-orm/core'
import { Transaction } from './entities/transactions'
const port=3000;

const app=express();
app.use(bodyParser.json());


async function test(){
    try{
        const orm = await MikroORM.init(config);
        console.log("Connected");
        const result = await orm.em.getConnection().execute('SELECT 1+1 AS result');
        console.log(result);
        await orm.close();
        console.log("connection closed successfully");
    } catch(err){
        console.log(err);
    }
}
async function insertTransaction(description:string, currency:string, originalAmount:number){
    try{
        const orm=await MikroORM.init(config);
        const transaction=new Transaction();
        transaction.date=new Date();
        transaction.description=description;
        transaction.currency=currency;
        transaction.originalAmount=originalAmount;
        transaction.amount_in_inr=originalAmount*80;
        const em=orm.em.fork();
        await em.persist(transaction).flush();
        console.log(transaction.id);
        await orm.close();
    } catch(err){
        console.log(err);
    }
}

async function getData(){
    const orm =await MikroORM.init(config);
    const em=orm.em.fork();
    const data=await em.find(Transaction,{});
    return data;
}

// async function insertMiddleware(req:Request, res:Response, next:NextFunction){
//     const description=req.
// }

app.get('/', async(req,res)=>{
    const allData= await getData();
    res.json(allData);
})

app.post('/newData', async (req,res)=>{
    const description=req.body.description;
    const originalAmount=parseInt(req.body.originalAmount,10);
    const currency=req.body.currency;
    const result=await insertTransaction(description,currency, originalAmount);
    res.status(200).json(result);
})

app.listen(port, ()=>{
    console.log(`App is running on port ${port}`);
})